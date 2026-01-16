import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAllUsers, deleteUser, deleteUserRefreshTokens } from '../_lib/db';
import { verifyAccessToken, getTokenFromHeader } from '../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

    if (req.method === 'GET') {
      const users = await getAllUsers();
      return res.status(200).json({ users });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      const userId = parseInt(id as string, 10);

      if (isNaN(userId)) {
        return res.status(400).json({ error: 'Ungültige Benutzer-ID' });
      }

      // Prevent self-deletion
      if (payload.userId === userId) {
        return res.status(400).json({ error: 'Sie können sich nicht selbst löschen' });
      }

      // Delete user's refresh tokens first
      await deleteUserRefreshTokens(userId);

      // Delete user
      const deleted = await deleteUser(userId);
      if (!deleted) {
        return res.status(404).json({ error: 'Benutzer nicht gefunden' });
      }

      return res.status(200).json({ message: 'Benutzer erfolgreich gelöscht' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Users error:', error);
    return res.status(500).json({ error: 'Interner Serverfehler' });
  }
}
