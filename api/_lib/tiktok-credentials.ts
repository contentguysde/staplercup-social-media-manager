import { sql } from '@vercel/postgres';
import axios from 'axios';

export interface TikTokCredentials {
  accessToken: string;
  refreshToken: string;
  openId: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
}

const TIKTOK_CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;
const TIKTOK_CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;

/**
 * Get TikTok credentials from database with automatic token refresh.
 * TikTok access tokens expire after 24 hours, so we auto-refresh when needed.
 */
export async function getTikTokCredentials(): Promise<TikTokCredentials | null> {
  try {
    const result = await sql`
      SELECT access_token, refresh_token, open_id, username, display_name, avatar_url,
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
  if (!TIKTOK_CLIENT_KEY || !TIKTOK_CLIENT_SECRET) {
    console.error('TikTok client credentials not configured');
    return null;
  }

  try {
    const response = await axios.post(
      'https://open.tiktokapis.com/v2/oauth/token/',
      new URLSearchParams({
        client_key: TIKTOK_CLIENT_KEY,
        client_secret: TIKTOK_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: creds.refresh_token,
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );

    const data = response.data;

    if (data.error) {
      console.error('TikTok token refresh error:', data.error, data.error_description);
      return null;
    }

    const newAccessToken = data.access_token;
    const newRefreshToken = data.refresh_token;
    const expiresIn = data.expires_in || 86400; // 24h default
    const refreshExpiresIn = data.refresh_expires_in || 365 * 24 * 60 * 60;

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

    console.log('TikTok access token refreshed successfully');

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      openId: creds.open_id,
      username: creds.username,
      displayName: creds.display_name,
      avatarUrl: creds.avatar_url,
    };
  } catch (error: any) {
    console.error('TikTok token refresh failed:', error.response?.data || error.message);
    return null;
  }
}
