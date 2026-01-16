import type { VercelRequest, VercelResponse } from '@vercel/node';
import { findUserById } from '../_lib/db';
import { verifyAccessToken, getTokenFromHeader, toPublicUser } from '../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = getTokenFromHeader(req.headers.authorization as string);
    if (!token) {
      return res.status(401).json({ error: 'Nicht authentifiziert' });
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      return res.status(401).json({ error: 'Ungültiger Token' });
    }

    const user = await findUserById(payload.userId);
    if (!user) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    return res.status(200).json({ user: toPublicUser(user) });
  } catch (error) {
    console.error('Get me error:', error);
    return res.status(500).json({ error: 'Interner Serverfehler' });
  }
}
