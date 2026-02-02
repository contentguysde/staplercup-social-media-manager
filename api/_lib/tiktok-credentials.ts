import { sql } from '@vercel/postgres';
import axios from 'axios';

export interface TikTokCredentials {
  accessToken: string;
  refreshToken: string;
  openId: string;
  businessId?: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
}

const TIKTOK_APP_ID = process.env.TIKTOK_APP_ID;
const TIKTOK_APP_SECRET = process.env.TIKTOK_APP_SECRET;

/**
 * Get TikTok Business API credentials from database with automatic token refresh.
 * Access tokens expire after 24 hours, so we auto-refresh when needed.
 */
export async function getTikTokCredentials(): Promise<TikTokCredentials | null> {
  try {
    const result = await sql`
      SELECT access_token, refresh_token, open_id, business_id, username, display_name, avatar_url,
             token_expires_at, refresh_token_expires_at
      FROM tiktok_credentials
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (result.rows.length === 0) {
      return null;
    }

    const creds = result.rows[0];
    const tokenExpiresAt = new Date(creds.token_expires_at);
    const refreshTokenExpiresAt = new Date(creds.refresh_token_expires_at);

    // Check if refresh token is expired (365 days)
    if (refreshTokenExpiresAt <= new Date()) {
      console.log('TikTok refresh token expired, user needs to re-authorize');
      return null;
    }

    // Check if access token is still valid (with 5 min buffer)
    const bufferMs = 5 * 60 * 1000;
    if (tokenExpiresAt.getTime() - bufferMs > Date.now()) {
      return {
        accessToken: creds.access_token,
        refreshToken: creds.refresh_token,
        openId: creds.open_id,
        businessId: creds.business_id || creds.open_id,
        username: creds.username,
        displayName: creds.display_name,
        avatarUrl: creds.avatar_url,
      };
    }

    // Access token expired — refresh it
    console.log('TikTok access token expired, refreshing...');
    return await refreshAccessToken(creds);
  } catch (error: any) {
    if (error.message?.includes('does not exist')) {
      return null;
    }
    console.error('Error fetching TikTok credentials:', error);
    return null;
  }
}

async function refreshAccessToken(creds: any): Promise<TikTokCredentials | null> {
  if (!TIKTOK_APP_ID || !TIKTOK_APP_SECRET) {
    console.error('TikTok app credentials not configured');
    return null;
  }

  try {
    // Try Business API refresh endpoint
    const response = await axios.post(
      'https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/',
      {
        app_id: TIKTOK_APP_ID,
        secret: TIKTOK_APP_SECRET,
        grant_type: 'refresh_token',
        refresh_token: creds.refresh_token,
      },
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const responseData = response.data;
    console.log('TikTok Business API refresh response:', JSON.stringify(responseData, null, 2));

    // Business API response format: { code: 0, data: { access_token, ... } }
    const data = responseData.data || responseData;

    if (responseData.code !== 0 && !data.access_token) {
      console.error('TikTok Business API token refresh error:', responseData);
      // Fallback: try standard v2 endpoint
      return await refreshAccessTokenV2(creds);
    }

    const newAccessToken = data.access_token;
    const newRefreshToken = data.refresh_token || creds.refresh_token;
    const expiresIn = data.expires_in || 86400;
    const refreshExpiresIn = data.refresh_token_expires_in || data.refresh_expires_in || 365 * 24 * 60 * 60;

    const newTokenExpiresAt = new Date(Date.now() + expiresIn * 1000);
    const newRefreshTokenExpiresAt = new Date(Date.now() + refreshExpiresIn * 1000);

    // Update credentials in database
    await sql`
      UPDATE tiktok_credentials
      SET access_token = ${newAccessToken},
          refresh_token = ${newRefreshToken},
          token_expires_at = ${newTokenExpiresAt.toISOString()},
          refresh_token_expires_at = ${newRefreshTokenExpiresAt.toISOString()},
          updated_at = CURRENT_TIMESTAMP
      WHERE open_id = ${creds.open_id}
    `;

    console.log('TikTok access token refreshed successfully via Business API');

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      openId: creds.open_id,
      businessId: creds.business_id || creds.open_id,
      username: creds.username,
      displayName: creds.display_name,
      avatarUrl: creds.avatar_url,
    };
  } catch (error: any) {
    console.error('TikTok Business API refresh failed:', error.response?.data || error.message);
    // Fallback to standard v2 refresh
    return await refreshAccessTokenV2(creds);
  }
}

async function refreshAccessTokenV2(creds: any): Promise<TikTokCredentials | null> {
  if (!TIKTOK_APP_ID || !TIKTOK_APP_SECRET) {
    return null;
  }

  try {
    console.log('Trying standard v2 token refresh as fallback...');
    const response = await axios.post(
      'https://open.tiktokapis.com/v2/oauth/token/',
      new URLSearchParams({
        client_key: TIKTOK_APP_ID,
        client_secret: TIKTOK_APP_SECRET,
        grant_type: 'refresh_token',
        refresh_token: creds.refresh_token,
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );

    const data = response.data;

    if (data.error) {
      console.error('v2 token refresh also failed:', data.error, data.error_description);
      return null;
    }

    const newAccessToken = data.access_token;
    const newRefreshToken = data.refresh_token || creds.refresh_token;
    const expiresIn = data.expires_in || 86400;
    const refreshExpiresIn = data.refresh_expires_in || 365 * 24 * 60 * 60;

    const newTokenExpiresAt = new Date(Date.now() + expiresIn * 1000);
    const newRefreshTokenExpiresAt = new Date(Date.now() + refreshExpiresIn * 1000);

    await sql`
      UPDATE tiktok_credentials
      SET access_token = ${newAccessToken},
          refresh_token = ${newRefreshToken},
          token_expires_at = ${newTokenExpiresAt.toISOString()},
          refresh_token_expires_at = ${newRefreshTokenExpiresAt.toISOString()},
          updated_at = CURRENT_TIMESTAMP
      WHERE open_id = ${creds.open_id}
    `;

    console.log('TikTok access token refreshed via v2 fallback');

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      openId: creds.open_id,
      businessId: creds.business_id || creds.open_id,
      username: creds.username,
      displayName: creds.display_name,
      avatarUrl: creds.avatar_url,
    };
  } catch (error: any) {
    console.error('v2 token refresh failed:', error.response?.data || error.message);
    return null;
  }
}
