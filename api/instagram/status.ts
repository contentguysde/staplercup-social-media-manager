import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAccessToken, getTokenFromHeader } from '../_lib/auth';
import axios from 'axios';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify authentication
    const token = getTokenFromHeader(req.headers.authorization as string);
    if (!token) {
      return res.status(401).json({ error: 'Nicht authentifiziert' });
    }

    try {
      verifyAccessToken(token);
    } catch {
      return res.status(401).json({ error: 'Ungültiger Token' });
    }

    const accessToken = process.env.META_ACCESS_TOKEN;
    const instagramAccountId = process.env.INSTAGRAM_ACCOUNT_ID;

    if (!accessToken || !instagramAccountId) {
      return res.status(200).json({
        success: true,
        data: {
          connected: false,
          usingMockData: true,
          error: 'Instagram nicht konfiguriert',
          errorType: 'token_invalid',
        },
      });
    }

    try {
      const response = await axios.get(
        `https://graph.instagram.com/v18.0/${instagramAccountId}`,
        {
          params: {
            fields: 'id,username',
            access_token: accessToken,
          },
        }
      );

      return res.status(200).json({
        success: true,
        data: {
          connected: true,
          usingMockData: false,
          username: response.data.username,
        },
      });
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || 'Verbindung fehlgeschlagen';
      const isExpired = errorMessage.includes('expired') || errorMessage.includes('Session');

      return res.status(200).json({
        success: true,
        data: {
          connected: false,
          usingMockData: true,
          error: errorMessage,
          errorType: isExpired ? 'token_expired' : 'token_invalid',
        },
      });
    }
  } catch (error) {
    console.error('Instagram status error:', error);
    return res.status(500).json({ error: 'Interner Serverfehler' });
  }
}
