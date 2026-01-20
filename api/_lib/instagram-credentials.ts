import { sql } from '@vercel/postgres';

export interface InstagramCredentials {
  accessToken: string;
  accountId: string;
  username?: string;
  source: 'oauth' | 'env';
}

/**
 * Get Instagram credentials - checks database (OAuth) first, then falls back to environment variables.
 * This ensures OAuth connections take priority over manually configured env vars.
 */
export async function getInstagramCredentials(): Promise<InstagramCredentials | null> {
  // First, try to get credentials from database (OAuth)
  try {
    const result = await sql`
      SELECT access_token, page_access_token, instagram_account_id, instagram_username, expires_at
      FROM instagram_credentials
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (result.rows.length > 0) {
      const creds = result.rows[0];
      const expiresAt = new Date(creds.expires_at);

      // Check if token is still valid
      if (expiresAt > new Date()) {
        // Use page_access_token if available (preferred for Instagram Business API),
        // otherwise fall back to the user's access_token
        const accessToken = creds.page_access_token || creds.access_token;

        return {
          accessToken,
          accountId: creds.instagram_account_id,
          username: creds.instagram_username,
          source: 'oauth',
        };
      }

      // Token is expired - log it but continue to fallback
      console.log('OAuth token expired, falling back to environment variables');
    }
  } catch (error: any) {
    // Table might not exist yet, or other DB error - fall through to env vars
    if (!error.message?.includes('does not exist')) {
      console.error('Error fetching OAuth credentials:', error);
    }
  }

  // Fallback to environment variables
  const accessToken = process.env.META_ACCESS_TOKEN;
  const accountId = process.env.INSTAGRAM_ACCOUNT_ID;

  if (accessToken && accountId && !accessToken.startsWith('your_')) {
    return {
      accessToken,
      accountId,
      source: 'env',
    };
  }

  // No valid credentials found
  return null;
}
