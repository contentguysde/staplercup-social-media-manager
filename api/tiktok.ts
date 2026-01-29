import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import { sql } from '@vercel/postgres';
import { getTikTokCredentials } from './_lib/tiktok-credentials';

const TIKTOK_CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;
const TIKTOK_CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;
const TIKTOK_REDIRECT_URI = process.env.TIKTOK_REDIRECT_URI || 'https://staplercup-social.vercel.app/api/tiktok/callback';

const SCOPES = 'user.info.basic,user.info.profile,video.list';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const action = (req.query.action as string) || '';

  try {
    if (req.method === 'GET' && action === 'authorize') {
      return handleAuthorize(res);
    }

    if (req.method === 'GET' && action === 'callback') {
      return handleCallback(req, res);
    }

    if (req.method === 'GET' && action === 'status') {
      return handleStatus(res);
    }

    if (req.method === 'POST' && action === 'disconnect') {
      return handleDisconnect(res);
    }

    if (req.method === 'GET' && action === 'interactions') {
      return handleInteractions(res);
    }

    return res.status(404).json({ error: 'Endpoint nicht gefunden' });
  } catch (error) {
    console.error('TikTok API error:', error);
    return res.status(500).json({ error: 'Interner Serverfehler' });
  }
}

// GET /api/tiktok/authorize
function handleAuthorize(res: VercelResponse) {
  if (!TIKTOK_CLIENT_KEY) {
    return res.status(500).json({ error: 'TIKTOK_CLIENT_KEY nicht konfiguriert' });
  }

  const state = Buffer.from(JSON.stringify({
    timestamp: Date.now(),
    random: Math.random().toString(36).substring(7),
  })).toString('base64');

  const authUrl = new URL('https://www.tiktok.com/v2/auth/authorize/');
  authUrl.searchParams.set('client_key', TIKTOK_CLIENT_KEY);
  authUrl.searchParams.set('scope', SCOPES);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', TIKTOK_REDIRECT_URI);
  authUrl.searchParams.set('state', state);

  return res.redirect(302, authUrl.toString());
}

// GET /api/tiktok/callback
async function handleCallback(req: VercelRequest, res: VercelResponse) {
  const { code, error, error_description, state } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'https://staplercup-social.vercel.app';

  if (error) {
    console.error('TikTok OAuth error:', error, error_description);
    return res.redirect(302, `${frontendUrl}/settings?tiktok_error=${encodeURIComponent(String(error_description || error))}`);
  }

  if (!code || typeof code !== 'string') {
    return res.redirect(302, `${frontendUrl}/settings?tiktok_error=${encodeURIComponent('Kein Autorisierungscode erhalten')}`);
  }

  if (!TIKTOK_CLIENT_KEY || !TIKTOK_CLIENT_SECRET) {
    return res.redirect(302, `${frontendUrl}/settings?tiktok_error=${encodeURIComponent('App-Konfiguration fehlt')}`);
  }

  try {
    // Step 1: Exchange code for access token
    const tokenResponse = await axios.post(
      'https://open.tiktokapis.com/v2/oauth/token/',
      new URLSearchParams({
        client_key: TIKTOK_CLIENT_KEY,
        client_secret: TIKTOK_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: TIKTOK_REDIRECT_URI,
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );

    const tokenData = tokenResponse.data;

    if (tokenData.error) {
      console.error('TikTok token exchange error:', tokenData);
      return res.redirect(302, `${frontendUrl}/settings?tiktok_error=${encodeURIComponent(tokenData.error_description || tokenData.error)}`);
    }

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const openId = tokenData.open_id;
    const expiresIn = tokenData.expires_in || 86400;
    const refreshExpiresIn = tokenData.refresh_expires_in || 365 * 24 * 60 * 60;

    // Step 2: Get user info
    let username = '';
    let displayName = '';
    let avatarUrl = '';

    try {
      const userResponse = await axios.get(
        'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url,username',
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      const userData = userResponse.data?.data?.user;
      if (userData) {
        username = userData.username || '';
        displayName = userData.display_name || '';
        avatarUrl = userData.avatar_url || '';
      }
    } catch (err) {
      console.warn('Could not fetch TikTok user info:', err);
    }

    // Step 3: Store credentials in database
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);
    const refreshTokenExpiresAt = new Date(Date.now() + refreshExpiresIn * 1000);

    await sql`
      CREATE TABLE IF NOT EXISTS tiktok_credentials (
        id SERIAL PRIMARY KEY,
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        open_id VARCHAR(255) NOT NULL,
        username VARCHAR(255),
        display_name VARCHAR(255),
        avatar_url TEXT,
        token_expires_at TIMESTAMP NOT NULL,
        refresh_token_expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Delete old credentials and insert new ones
    await sql`DELETE FROM tiktok_credentials`;
    await sql`
      INSERT INTO tiktok_credentials (access_token, refresh_token, open_id, username, display_name, avatar_url, token_expires_at, refresh_token_expires_at)
      VALUES (${accessToken}, ${refreshToken}, ${openId}, ${username}, ${displayName}, ${avatarUrl}, ${tokenExpiresAt.toISOString()}, ${refreshTokenExpiresAt.toISOString()})
    `;

    return res.redirect(302, `${frontendUrl}/settings?tiktok_success=true&tiktok_username=${encodeURIComponent(username || displayName || '')}`);
  } catch (error: any) {
    console.error('TikTok OAuth error:', JSON.stringify(error.response?.data || error.message, null, 2));
    let errorMessage = 'Token-Austausch fehlgeschlagen';
    if (error.response?.data?.error_description) {
      errorMessage = error.response.data.error_description;
    } else if (error.message) {
      errorMessage = error.message;
    }
    return res.redirect(302, `${frontendUrl}/settings?tiktok_error=${encodeURIComponent(errorMessage)}`);
  }
}

// GET /api/tiktok/status
async function handleStatus(res: VercelResponse) {
  try {
    const result = await sql`
      SELECT open_id, username, display_name, avatar_url, token_expires_at, refresh_token_expires_at
      FROM tiktok_credentials
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (result.rows.length > 0) {
      const creds = result.rows[0];
      const refreshExpiresAt = new Date(creds.refresh_token_expires_at);
      const isValid = refreshExpiresAt > new Date();

      return res.status(200).json({
        success: true,
        data: {
          connected: isValid,
          username: creds.username,
          displayName: creds.display_name,
          avatarUrl: creds.avatar_url,
          openId: creds.open_id,
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: { connected: false },
    });
  } catch (error: any) {
    if (error.message?.includes('does not exist')) {
      return res.status(200).json({
        success: true,
        data: { connected: false },
      });
    }
    console.error('TikTok status error:', error);
    return res.status(500).json({ success: false, error: 'Status konnte nicht abgerufen werden' });
  }
}

// POST /api/tiktok/disconnect
async function handleDisconnect(res: VercelResponse) {
  try {
    // Optionally revoke the token
    try {
      const result = await sql`SELECT access_token FROM tiktok_credentials LIMIT 1`;
      if (result.rows.length > 0 && TIKTOK_CLIENT_KEY) {
        await axios.post(
          'https://open.tiktokapis.com/v2/oauth/revoke/',
          new URLSearchParams({
            client_key: TIKTOK_CLIENT_KEY,
            token: result.rows[0].access_token,
          }).toString(),
          {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          }
        );
      }
    } catch (err) {
      console.warn('Could not revoke TikTok token:', err);
    }

    await sql`DELETE FROM tiktok_credentials`;

    return res.status(200).json({
      success: true,
      message: 'TikTok-Verbindung erfolgreich getrennt',
    });
  } catch (error: any) {
    if (error.message?.includes('does not exist')) {
      return res.status(200).json({ success: true, message: 'Keine Verbindung vorhanden' });
    }
    console.error('TikTok disconnect error:', error);
    return res.status(500).json({ success: false, error: 'Verbindung konnte nicht getrennt werden' });
  }
}

// GET /api/tiktok/interactions
async function handleInteractions(res: VercelResponse) {
  const credentials = await getTikTokCredentials();

  if (!credentials) {
    return res.status(200).json({
      success: true,
      data: {
        interactions: [],
        account: null,
      },
    });
  }

  try {
    // Fetch user's videos
    const videosResponse = await axios.post(
      'https://open.tiktokapis.com/v2/video/list/?fields=id,title,video_description,cover_image_url,share_url,create_time,like_count,comment_count,share_count,view_count',
      { max_count: 20 },
      {
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const videosData = videosResponse.data?.data;
    const videos = videosData?.videos || [];

    // Transform videos to interaction format
    const interactions = videos.map((video: any) => ({
      id: `tiktok_video_${video.id}`,
      type: 'comment' as const,
      platform: 'tiktok' as const,
      content: video.title || video.video_description || '(TikTok Video)',
      from: {
        id: credentials.openId,
        username: credentials.username || '',
        name: credentials.displayName || credentials.username || 'TikTok User',
        profilePicture: credentials.avatarUrl,
      },
      timestamp: new Date(video.create_time * 1000).toISOString(),
      status: 'read' as const,
      context: {
        mediaId: video.id,
        mediaUrl: video.cover_image_url,
        mediaPermalink: video.share_url,
        mediaType: 'VIDEO',
        stats: {
          likes: video.like_count || 0,
          comments: video.comment_count || 0,
          shares: video.share_count || 0,
          views: video.view_count || 0,
        },
      },
    }));

    return res.status(200).json({
      success: true,
      data: {
        interactions,
        account: {
          username: credentials.username,
          displayName: credentials.displayName,
          avatarUrl: credentials.avatarUrl,
        },
        hasMore: !!videosData?.has_more,
        cursor: videosData?.cursor,
      },
    });
  } catch (error: any) {
    console.error('TikTok interactions error:', error.response?.data || error.message);

    // Check for auth errors
    if (error.response?.status === 401 || error.response?.data?.error?.code === 'access_token_invalid') {
      return res.status(200).json({
        success: false,
        error: 'TikTok-Token ungültig. Bitte erneut verbinden.',
        errorType: 'token_invalid',
        data: { interactions: [] },
      });
    }

    return res.status(200).json({
      success: false,
      error: 'TikTok-Videos konnten nicht geladen werden',
      data: { interactions: [] },
    });
  }
}
