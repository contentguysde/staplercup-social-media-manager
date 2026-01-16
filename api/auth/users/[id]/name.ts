import type { VercelRequest, VercelResponse } from '@vercel/node';
import { updateUserName, findUserById } from '../../../_lib/db';
import { verifyAccessToken, getTokenFromHeader, toPublicUser } from '../../../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify admin authentication
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

    if (payload.role !== 'admin') {
      return res.status(403).json({ error: 'Keine Berechtigung' });
    }

    const { id } = req.query;
    const userId = parseInt(id as string, 10);
    const { name } = req.body;

    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Ungültige Benutzer-ID' });
    }

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Name ist erforderlich' });
    }

    const updated = await updateUserName(userId, name.trim());
    if (!updated) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    const user = await findUserById(userId);
    return res.status(200).json({ user: user ? toPublicUser(user) : null });
  } catch (error) {
    console.error('Update name error:', error);
    return res.status(500).json({ error: 'Interner Serverfehler' });
  }
}
