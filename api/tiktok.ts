import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import { sql } from '@vercel/postgres';
import { getTikTokCredentials } from './_lib/tiktok-credentials';

const TIKTOK_APP_ID = process.env.TIKTOK_APP_ID;
const TIKTOK_APP_SECRET = process.env.TIKTOK_APP_SECRET;
const TIKTOK_REDIRECT_URI = process.env.TIKTOK_REDIRECT_URI || 'https://staplercup-social.vercel.app/api/tiktok/callback';

// Business API scopes for organic comment management
const SCOPES = 'biz.brand.insights,comment.list';

const BUSINESS_API_BASE = 'https://business-api.tiktok.com/open_api/v1.3';

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

    if (req.method === 'GET' && action === 'comments') {
      return handleComments(req, res);
    }

    if (req.method === 'POST' && action === 'reply') {
      return handleReplyComment(req, res);
    }

    return res.status(404).json({ error: 'Endpoint nicht gefunden' });
  } catch (error) {
    console.error('TikTok API error:', error);
    return res.status(500).json({ error: 'Interner Serverfehler' });
  }
}

// GET /api/tiktok/authorize
function handleAuthorize(res: VercelResponse) {
  if (!TIKTOK_APP_ID) {
    return res.status(500).json({ error: 'TIKTOK_APP_ID nicht konfiguriert' });
  }

  const state = Buffer.from(JSON.stringify({
    timestamp: Date.now(),
    random: Math.random().toString(36).substring(7),
  })).toString('base64');

  // Use the TikTok account holder authorization URL (v2 auth with business scopes)
  const authUrl = new URL('https://www.tiktok.com/v2/auth/authorize/');
  authUrl.searchParams.set('client_key', TIKTOK_APP_ID);
  authUrl.searchParams.set('scope', SCOPES);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', TIKTOK_REDIRECT_URI);
  authUrl.searchParams.set('state', state);

  return res.redirect(302, authUrl.toString());
}

// GET /api/tiktok/callback
async function handleCallback(req: VercelRequest, res: VercelResponse) {
  const { code, error, error_description } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'https://staplercup-social.vercel.app';

  if (error) {
    console.error('TikTok OAuth error:', error, error_description);
    return res.redirect(302, `${frontendUrl}/settings?tiktok_error=${encodeURIComponent(String(error_description || error))}`);
  }

  if (!code || typeof code !== 'string') {
    return res.redirect(302, `${frontendUrl}/settings?tiktok_error=${encodeURIComponent('Kein Autorisierungscode erhalten')}`);
  }

  if (!TIKTOK_APP_ID || !TIKTOK_APP_SECRET) {
    return res.redirect(302, `${frontendUrl}/settings?tiktok_error=${encodeURIComponent('App-Konfiguration fehlt')}`);
  }

  try {
    // Step 1: Exchange code for access token via Business API
    console.log('Exchanging TikTok auth code via Business API...');
    let tokenData: any = null;

    try {
      const businessTokenResponse = await axios.post(
        `${BUSINESS_API_BASE}/oauth2/access_token/`,
        {
          app_id: TIKTOK_APP_ID,
          secret: TIKTOK_APP_SECRET,
          auth_code: code,
        },
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );

      console.log('Business API token response:', JSON.stringify(businessTokenResponse.data, null, 2));

      if (businessTokenResponse.data.code === 0 && businessTokenResponse.data.data?.access_token) {
        tokenData = businessTokenResponse.data.data;
      } else {
        console.warn('Business API token exchange returned non-success:', businessTokenResponse.data);
      }
    } catch (businessErr: any) {
      console.warn('Business API token exchange failed, trying v2 fallback:', businessErr.response?.data || businessErr.message);
    }

    // Fallback to standard v2 token endpoint
    if (!tokenData) {
      console.log('Trying standard v2 token exchange as fallback...');
      const v2TokenResponse = await axios.post(
        'https://open.tiktokapis.com/v2/oauth/token/',
        new URLSearchParams({
          client_key: TIKTOK_APP_ID,
          client_secret: TIKTOK_APP_SECRET,
          code,
          grant_type: 'authorization_code',
          redirect_uri: TIKTOK_REDIRECT_URI,
        }).toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }
      );

      console.log('v2 token response:', JSON.stringify(v2TokenResponse.data, null, 2));

      if (v2TokenResponse.data.error) {
        throw new Error(v2TokenResponse.data.error_description || v2TokenResponse.data.error);
      }

      tokenData = v2TokenResponse.data;
    }

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token || '';
    const openId = tokenData.open_id || tokenData.creator_id || '';
    const businessId = tokenData.business_id || tokenData.creator_id || openId;
    const expiresIn = tokenData.expires_in || 86400;
    const refreshExpiresIn = tokenData.refresh_token_expires_in || tokenData.refresh_expires_in || 365 * 24 * 60 * 60;

    // Step 2: Try to get user info
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
    } catch (err: any) {
      console.warn('Could not fetch TikTok user info (may need user.info.basic scope):', err.response?.data || err.message);
    }

    // Step 3: Store credentials in database
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);
    const refreshTokenExpiresAt = new Date(Date.now() + refreshExpiresIn * 1000);

    // Recreate table with business_id column
    await sql`
      CREATE TABLE IF NOT EXISTS tiktok_credentials (
        id SERIAL PRIMARY KEY,
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        open_id VARCHAR(255) NOT NULL,
        business_id VARCHAR(255),
        username VARCHAR(255),
        display_name VARCHAR(255),
        avatar_url TEXT,
        token_expires_at TIMESTAMP NOT NULL,
        refresh_token_expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Add business_id column if it doesn't exist (for migration from old schema)
    try {
      await sql`ALTER TABLE tiktok_credentials ADD COLUMN IF NOT EXISTS business_id VARCHAR(255)`;
    } catch (_) {
      // Column might already exist
    }

    // Delete old credentials and insert new ones
    await sql`DELETE FROM tiktok_credentials`;
    await sql`
      INSERT INTO tiktok_credentials (access_token, refresh_token, open_id, business_id, username, display_name, avatar_url, token_expires_at, refresh_token_expires_at)
      VALUES (${accessToken}, ${refreshToken}, ${openId}, ${businessId}, ${username}, ${displayName}, ${avatarUrl}, ${tokenExpiresAt.toISOString()}, ${refreshTokenExpiresAt.toISOString()})
    `;

    return res.redirect(302, `${frontendUrl}/settings?tiktok_success=true&tiktok_username=${encodeURIComponent(username || displayName || '')}`);
  } catch (error: any) {
    console.error('TikTok OAuth error:', JSON.stringify(error.response?.data || error.message, null, 2));
    let errorMessage = 'Token-Austausch fehlgeschlagen';
    if (error.response?.data?.error_description) {
      errorMessage = error.response.data.error_description;
    } else if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
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
      SELECT open_id, business_id, username, display_name, avatar_url, token_expires_at, refresh_token_expires_at
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
          businessId: creds.business_id,
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
      if (result.rows.length > 0 && TIKTOK_APP_ID) {
        await axios.post(
          'https://open.tiktokapis.com/v2/oauth/revoke/',
          new URLSearchParams({
            client_key: TIKTOK_APP_ID,
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

  const businessId = credentials.businessId || credentials.openId;

  // Strategy 1: Try Business API video list endpoint
  try {
    console.log(`[TikTok] Fetching videos via Business API for business_id: ${businessId}`);

    const businessResponse = await axios.get(
      `${BUSINESS_API_BASE}/business/video/list/`,
      {
        params: {
          business_id: businessId,
          max_count: 20,
        },
        headers: {
          'Access-Token': credentials.accessToken,
        },
      }
    );

    console.log('[TikTok] Business API video list response:', JSON.stringify(businessResponse.data, null, 2));

    const responseData = businessResponse.data;

    if (responseData.code === 0 && responseData.data) {
      const videos = responseData.data.videos || [];
      console.log(`[TikTok] Business API returned ${videos.length} videos`);

      const interactions = videos.map((video: any) => ({
        id: `tiktok_video_${video.item_id || video.video_id || video.id}`,
        type: 'post' as const,
        platform: 'tiktok' as const,
        content: video.video_description || video.title || '(TikTok Video)',
        from: {
          id: credentials.openId,
          username: credentials.username || '',
          name: credentials.displayName || credentials.username || 'TikTok User',
          profilePicture: credentials.avatarUrl,
        },
        timestamp: new Date((video.create_time || 0) * 1000).toISOString(),
        status: 'read' as const,
        context: {
          mediaId: video.item_id || video.video_id || video.id,
          mediaUrl: video.thumbnail_url || video.cover_image_url,
          mediaPermalink: video.share_url || video.embed_link,
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
          source: 'business_api',
          hasMore: !!responseData.data.has_more,
          cursor: responseData.data.cursor,
        },
      });
    } else {
      console.warn('[TikTok] Business API video list returned non-success:', responseData.code, responseData.message);
    }
  } catch (businessErr: any) {
    console.warn('[TikTok] Business API video list failed:', businessErr.response?.status, businessErr.response?.data || businessErr.message);
  }

  // Strategy 2: Try standard v2 API video list (requires video.list scope)
  try {
    console.log('[TikTok] Trying v2 API video list as fallback...');

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

    console.log('[TikTok] v2 API video list response:', JSON.stringify(videosResponse.data, null, 2));

    const videosData = videosResponse.data?.data;
    const videos = videosData?.videos || [];

    const interactions = videos.map((video: any) => ({
      id: `tiktok_video_${video.id}`,
      type: 'post' as const,
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
        source: 'v2_api',
        hasMore: !!videosData?.has_more,
        cursor: videosData?.cursor,
      },
    });
  } catch (v2Err: any) {
    console.error('[TikTok] v2 API video list also failed:', v2Err.response?.status, v2Err.response?.data || v2Err.message);

    // Check for auth errors
    const status = v2Err.response?.status;
    const errorCode = v2Err.response?.data?.error?.code;

    if (status === 401 || errorCode === 'access_token_invalid') {
      return res.status(200).json({
        success: false,
        error: 'TikTok-Token ungültig. Bitte erneut verbinden.',
        errorType: 'token_invalid',
        data: { interactions: [] },
      });
    }

    // Return detailed error for debugging
    return res.status(200).json({
      success: false,
      error: 'TikTok-Videos konnten nicht geladen werden. Möglicherweise fehlt der "video.list" Scope.',
      errorDetails: {
        businessApiError: 'See server logs',
        v2ApiError: v2Err.response?.data || v2Err.message,
      },
      data: { interactions: [] },
    });
  }
}

// GET /api/tiktok/comments?video_id=xxx
async function handleComments(req: VercelRequest, res: VercelResponse) {
  const videoId = req.query.video_id as string;

  if (!videoId) {
    return res.status(400).json({ success: false, error: 'video_id ist erforderlich' });
  }

  const credentials = await getTikTokCredentials();

  if (!credentials) {
    return res.status(200).json({
      success: false,
      error: 'TikTok nicht verbunden',
      data: { comments: [] },
    });
  }

  const businessId = credentials.businessId || credentials.openId;

  try {
    // Try Business API organic comment list endpoint
    console.log(`[TikTok] Fetching comments for video ${videoId} via Business API (business_id: ${businessId})...`);

    const commentsResponse = await axios.get(
      `${BUSINESS_API_BASE}/business/comment/list/`,
      {
        params: {
          business_id: businessId,
          video_id: videoId,
          count: 50,
        },
        headers: {
          'Access-Token': credentials.accessToken,
        },
      }
    );

    console.log('[TikTok] Business API comments response:', JSON.stringify(commentsResponse.data, null, 2));

    const responseData = commentsResponse.data;

    if (responseData.code !== 0) {
      console.error('Business API comment list error:', responseData);
      return res.status(200).json({
        success: false,
        error: responseData.message || 'Kommentare konnten nicht geladen werden',
        data: { comments: [] },
      });
    }

    const comments = (responseData.data?.comments || []).map((comment: any) => ({
      id: comment.comment_id || comment.id,
      text: comment.text || comment.comment_text || '',
      username: comment.username || comment.user_name || 'Unknown',
      userId: comment.user_id || '',
      profileImage: comment.profile_image || comment.avatar_url || '',
      createTime: comment.create_time,
      likeCount: comment.like_count || 0,
      replyCount: comment.reply_count || 0,
      parentCommentId: comment.parent_comment_id || null,
    }));

    return res.status(200).json({
      success: true,
      data: {
        comments,
        hasMore: responseData.data?.has_more || false,
        cursor: responseData.data?.cursor,
      },
    });
  } catch (error: any) {
    console.error('TikTok comments error:', error.response?.data || error.message);

    return res.status(200).json({
      success: false,
      error: 'Kommentare konnten nicht geladen werden',
      errorDetails: error.response?.data || error.message,
      data: { comments: [] },
    });
  }
}

// POST /api/tiktok/reply
async function handleReplyComment(req: VercelRequest, res: VercelResponse) {
  const { commentId, text, videoId } = req.body || {};

  if (!commentId || !text) {
    return res.status(400).json({ success: false, error: 'commentId und text sind erforderlich' });
  }

  const credentials = await getTikTokCredentials();

  if (!credentials) {
    return res.status(401).json({
      success: false,
      error: 'TikTok nicht verbunden',
    });
  }

  const businessId = credentials.businessId || credentials.openId;

  try {
    console.log(`Replying to TikTok comment ${commentId}...`);

    const replyResponse = await axios.post(
      `${BUSINESS_API_BASE}/business/comment/reply/`,
      {
        business_id: businessId,
        comment_id: commentId,
        text,
        video_id: videoId,
      },
      {
        headers: {
          'Access-Token': credentials.accessToken,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('Business API reply response:', JSON.stringify(replyResponse.data, null, 2));

    const responseData = replyResponse.data;

    if (responseData.code !== 0) {
      console.error('Business API reply error:', responseData);
      return res.status(200).json({
        success: false,
        error: responseData.message || 'Antwort konnte nicht gesendet werden',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        commentId: responseData.data?.comment_id,
      },
      message: 'Antwort erfolgreich gesendet',
    });
  } catch (error: any) {
    console.error('TikTok reply error:', error.response?.data || error.message);

    return res.status(200).json({
      success: false,
      error: 'Antwort konnte nicht gesendet werden',
      errorDetails: error.response?.data || error.message,
    });
  }
}
