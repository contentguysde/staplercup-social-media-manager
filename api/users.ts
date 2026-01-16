import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  getAllUsers,
  deleteUser,
  deleteUserRefreshTokens,
  updateUserRole,
  updateUserName,
  findUserById,
} from './_lib/db';
import {
  verifyAccessToken,
  getTokenFromHeader,
  toPublicUser,
  Role,
} from './_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Verify admin authentication for all user management operations
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

    // Extract path from query parameter (set by Vercel rewrite)
    // /api/users -> path = undefined
    // /api/users/123 -> path = "123"
    // /api/users/123/role -> path = "123/role"
    const pathParam = (req.query.path as string) || '';
    const pathParts = pathParam.split('/').filter(Boolean);

    const userId = pathParts[0] ? parseInt(pathParts[0], 10) : null;
    const action = pathParts[1] || null; // 'role', 'name', or null

    // GET /api/users - List all users
    if (req.method === 'GET' && !userId) {
      const users = await getAllUsers();
      return res.status(200).json({ users });
    }

    // DELETE /api/users/[id] - Delete user
    if (req.method === 'DELETE' && userId && !action) {
      if (isNaN(userId)) {
        return res.status(400).json({ error: 'Ungültige Benutzer-ID' });
      }

      if (payload.userId === userId) {
        return res.status(400).json({ error: 'Sie können sich nicht selbst löschen' });
      }

      await deleteUserRefreshTokens(userId);
      const deleted = await deleteUser(userId);

      if (!deleted) {
        return res.status(404).json({ error: 'Benutzer nicht gefunden' });
      }

      return res.status(200).json({ message: 'Benutzer erfolgreich gelöscht' });
    }

    // PUT /api/users/[id]/role - Update user role
    if (req.method === 'PUT' && userId && action === 'role') {
      if (isNaN(userId)) {
        return res.status(400).json({ error: 'Ungültige Benutzer-ID' });
      }

      const { role } = req.body;

      const validRoles: Role[] = ['admin', 'manager', 'viewer'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: 'Ungültige Rolle' });
      }

      if (payload.userId === userId) {
        return res.status(400).json({ error: 'Sie können Ihre eigene Rolle nicht ändern' });
      }

      const updated = await updateUserRole(userId, role);
      if (!updated) {
        return res.status(404).json({ error: 'Benutzer nicht gefunden' });
      }

      const user = await findUserById(userId);
      return res.status(200).json({ user: user ? toPublicUser(user) : null });
    }

    // PUT /api/users/[id]/name - Update user name
    if (req.method === 'PUT' && userId && action === 'name') {
      if (isNaN(userId)) {
        return res.status(400).json({ error: 'Ungültige Benutzer-ID' });
      }

      const { name } = req.body;

      if (!name || name.trim().length === 0) {
        return res.status(400).json({ error: 'Name ist erforderlich' });
      }

      const updated = await updateUserName(userId, name.trim());
      if (!updated) {
        return res.status(404).json({ error: 'Benutzer nicht gefunden' });
      }

      const user = await findUserById(userId);
      return res.status(200).json({ user: user ? toPublicUser(user) : null });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Users error:', error);
    return res.status(500).json({ error: 'Interner Serverfehler' });
  }
}
