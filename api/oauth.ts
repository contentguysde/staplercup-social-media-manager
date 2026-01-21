import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import { sql } from '@vercel/postgres';

// Instagram OAuth configuration
const INSTAGRAM_APP_ID = process.env.META_APP_ID;
const INSTAGRAM_APP_SECRET = process.env.META_APP_SECRET;
const REDIRECT_URI = process.env.OAUTH_REDIRECT_URI || 'https://staplercup-social.vercel.app/api/oauth/callback';

// Scopes for Facebook Graph API - Instagram Business Account access
// These are standard permissions that work without App Review for app admins/developers
// See: https://developers.facebook.com/docs/permissions
const SCOPES = [
  'pages_show_list',                    // List user's Facebook Pages
  'pages_read_engagement',              // Read Page posts and engagement
  'pages_manage_metadata',              // Manage Page metadata
  'instagram_basic',                    // Basic Instagram account info
  'instagram_content_publish',          // Publish to Instagram (for admins without review)
  'instagram_manage_comments',          // Read/manage comments (for admins without review)
  'instagram_manage_insights',          // Access insights
].join(',');

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle OPTIONS preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const action = (req.query.action as string) || '';

  try {
    // GET /api/oauth/authorize - Start OAuth flow
    if (req.method === 'GET' && action === 'authorize') {
      return handleAuthorize(req, res);
    }

    // GET /api/oauth/callback - Handle OAuth callback from Instagram
    if (req.method === 'GET' && action === 'callback') {
      return handleCallback(req, res);
    }

    // GET /api/oauth/status - Check if Instagram is connected
    if (req.method === 'GET' && action === 'status') {
      return handleStatus(res);
    }

    // POST /api/oauth/disconnect - Remove stored credentials
    if (req.method === 'POST' && action === 'disconnect') {
      return handleDisconnect(res);
    }

    return res.status(404).json({ error: 'Endpoint nicht gefunden' });
  } catch (error) {
    console.error('OAuth error:', error);
    return res.status(500).json({ error: 'Interner Serverfehler' });
  }
}

// GET /api/oauth/authorize - Redirect to Instagram authorization
function handleAuthorize(req: VercelRequest, res: VercelResponse) {
  if (!INSTAGRAM_APP_ID) {
    return res.status(500).json({ error: 'META_APP_ID nicht konfiguriert' });
  }

  // Generate state parameter for CSRF protection
  const state = Buffer.from(JSON.stringify({
    timestamp: Date.now(),
    random: Math.random().toString(36).substring(7),
  })).toString('base64');

  // Build authorization URL
  const authUrl = new URL('https://www.facebook.com/v18.0/dialog/oauth');
  authUrl.searchParams.set('client_id', INSTAGRAM_APP_ID);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('scope', SCOPES);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('state', state);

  // Redirect to Facebook/Instagram authorization page
  return res.redirect(302, authUrl.toString());
}

// GET /api/oauth/callback - Handle callback from Instagram
async function handleCallback(req: VercelRequest, res: VercelResponse) {
  const { code, error, error_description } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'https://staplercup-social.vercel.app';

  // Handle error from Instagram
  if (error) {
    console.error('OAuth error from Instagram:', error, error_description);
    return res.redirect(302, `${frontendUrl}/settings?oauth_error=${encodeURIComponent(String(error_description || error))}`);
  }

  // Verify code is present
  if (!code || typeof code !== 'string') {
    return res.redirect(302, `${frontendUrl}/settings?oauth_error=${encodeURIComponent('Kein Autorisierungscode erhalten')}`);
  }

  if (!INSTAGRAM_APP_ID || !INSTAGRAM_APP_SECRET) {
    return res.redirect(302, `${frontendUrl}/settings?oauth_error=${encodeURIComponent('App-Konfiguration fehlt')}`);
  }

  try {
    // Step 1: Exchange code for short-lived access token
    const tokenResponse = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
      params: {
        client_id: INSTAGRAM_APP_ID,
        client_secret: INSTAGRAM_APP_SECRET,
        redirect_uri: REDIRECT_URI,
        code,
      },
    });

    const shortLivedToken = tokenResponse.data.access_token;

    // Step 2: Exchange for long-lived token (60 days)
    const longLivedResponse = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: INSTAGRAM_APP_ID,
        client_secret: INSTAGRAM_APP_SECRET,
        fb_exchange_token: shortLivedToken,
      },
    });

    const longLivedToken = longLivedResponse.data.access_token;
    // expires_in is in seconds, default to 60 days if not provided
    const expiresIn = longLivedResponse.data.expires_in || (60 * 24 * 60 * 60);

    // Step 3: Get user's Facebook pages
    const pagesResponse = await axios.get('https://graph.facebook.com/v18.0/me/accounts', {
      params: {
        access_token: longLivedToken,
      },
    });

    const pages = pagesResponse.data.data || [];

    if (pages.length === 0) {
      return res.redirect(302, `${frontendUrl}/settings?oauth_error=${encodeURIComponent('Keine Facebook-Seiten gefunden. Bitte verbinde eine Facebook-Seite mit deinem Instagram-Konto.')}`);
    }

    // Step 4: Get Instagram Business Account ID from the first page
    let instagramAccountId = null;
    let instagramUsername = null;
    let pageAccessToken = null;

    for (const page of pages) {
      try {
        const igAccountResponse = await axios.get(`https://graph.facebook.com/v18.0/${page.id}`, {
          params: {
            fields: 'instagram_business_account{id,username}',
            access_token: page.access_token,
          },
        });

        if (igAccountResponse.data.instagram_business_account) {
          instagramAccountId = igAccountResponse.data.instagram_business_account.id;
          instagramUsername = igAccountResponse.data.instagram_business_account.username;
          pageAccessToken = page.access_token;
          break;
        }
      } catch (err) {
        console.log(`Page ${page.id} has no Instagram business account`);
      }
    }

    if (!instagramAccountId) {
      return res.redirect(302, `${frontendUrl}/settings?oauth_error=${encodeURIComponent('Kein Instagram Business-Konto gefunden. Bitte stelle sicher, dass dein Instagram-Konto mit einer Facebook-Seite verbunden ist.')}`);
    }

    // Step 5: Store the tokens in database
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    await sql`
      CREATE TABLE IF NOT EXISTS instagram_credentials (
        id SERIAL PRIMARY KEY,
        access_token TEXT NOT NULL,
        page_access_token TEXT,
        instagram_account_id VARCHAR(255) NOT NULL,
        instagram_username VARCHAR(255),
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Delete old credentials and insert new ones
    await sql`DELETE FROM instagram_credentials`;
    await sql`
      INSERT INTO instagram_credentials (access_token, page_access_token, instagram_account_id, instagram_username, expires_at)
      VALUES (${longLivedToken}, ${pageAccessToken}, ${instagramAccountId}, ${instagramUsername}, ${expiresAt.toISOString()})
    `;

    // Redirect back to settings with success
    return res.redirect(302, `${frontendUrl}/settings?oauth_success=true&username=${encodeURIComponent(instagramUsername || '')}`);

  } catch (error: any) {
    console.error('OAuth token exchange error:', JSON.stringify(error.response?.data || error.message, null, 2));
    // Get detailed error message from Facebook API
    let errorMessage = 'Token-Austausch fehlgeschlagen';
    if (error.response?.data?.error) {
      const fbError = error.response.data.error;
      errorMessage = `${fbError.message || errorMessage}${fbError.error_subcode ? ` (Code: ${fbError.error_subcode})` : ''}`;
    } else if (error.message) {
      errorMessage = error.message;
    }
    return res.redirect(302, `${frontendUrl}/settings?oauth_error=${encodeURIComponent(errorMessage)}`);
  }
}

// GET /api/oauth/status - Check connection status
async function handleStatus(res: VercelResponse) {
  try {
    // First check database for OAuth credentials
    const result = await sql`SELECT * FROM instagram_credentials ORDER BY created_at DESC LIMIT 1`;

    if (result.rows.length > 0) {
      const creds = result.rows[0];
      const expiresAt = new Date(creds.expires_at);
      const daysUntilExpiry = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      const isValid = expiresAt > new Date();

      return res.status(200).json({
        success: true,
        data: {
          connected: isValid,
          source: 'oauth',
          username: creds.instagram_username,
          accountId: creds.instagram_account_id,
          expiresAt: expiresAt.toISOString(),
          daysUntilExpiry: isValid ? daysUntilExpiry : 0,
        },
      });
    }

    // Fall back to environment variables
    const accessToken = process.env.META_ACCESS_TOKEN;
    const accountId = process.env.INSTAGRAM_ACCOUNT_ID;

    if (accessToken && accountId && !accessToken.startsWith('your_')) {
      return res.status(200).json({
        success: true,
        data: {
          connected: true,
          source: 'env',
          accountId,
          message: 'Verbunden über Umgebungsvariablen',
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        connected: false,
        source: null,
      },
    });

  } catch (error: any) {
    // Table might not exist yet
    if (error.message?.includes('does not exist')) {
      const accessToken = process.env.META_ACCESS_TOKEN;
      const accountId = process.env.INSTAGRAM_ACCOUNT_ID;

      if (accessToken && accountId && !accessToken.startsWith('your_')) {
        return res.status(200).json({
          success: true,
          data: {
            connected: true,
            source: 'env',
            accountId,
          },
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          connected: false,
          source: null,
        },
      });
    }

    console.error('OAuth status error:', error);
    return res.status(500).json({
      success: false,
      error: 'Status konnte nicht abgerufen werden',
    });
  }
}

// POST /api/oauth/disconnect - Remove stored credentials
async function handleDisconnect(res: VercelResponse) {
  try {
    // Delete all stored Instagram credentials
    await sql`DELETE FROM instagram_credentials`;

    return res.status(200).json({
      success: true,
      message: 'Verbindung erfolgreich getrennt',
    });
  } catch (error: any) {
    // Table might not exist, which is fine
    if (error.message?.includes('does not exist')) {
      return res.status(200).json({
        success: true,
        message: 'Keine Verbindung vorhanden',
      });
    }

    console.error('OAuth disconnect error:', error);
    return res.status(500).json({
      success: false,
      error: 'Verbindung konnte nicht getrennt werden',
    });
  }
}
