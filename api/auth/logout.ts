import type { VercelRequest, VercelResponse } from '@vercel/node';
import { deleteRefreshToken } from '../_lib/db';
import { parseCookies } from '../_lib/auth';
import { serialize } from 'cookie';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const cookies = parseCookies(req.headers.cookie);
    const refreshToken = cookies.refreshToken;

    if (refreshToken) {
      await deleteRefreshToken(refreshToken);
    }

    res.setHeader('Set-Cookie', serialize('refreshToken', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0,
      path: '/',
    }));

    return res.status(200).json({ message: 'Erfolgreich abgemeldet' });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ error: 'Interner Serverfehler' });
  }
}
