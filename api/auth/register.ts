import type { VercelRequest, VercelResponse } from '@vercel/node';
import { findUserByEmail, createUser } from '../_lib/db';
import {
  hashPassword,
  verifyAccessToken,
  getTokenFromHeader,
  toPublicUser,
  Role,
} from '../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
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

    const { email, password, name, role = 'viewer' } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'E-Mail, Passwort und Name sind erforderlich' });
    }

    // Check if user already exists
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'Ein Benutzer mit dieser E-Mail existiert bereits' });
    }

    // Validate role
    const validRoles: Role[] = ['admin', 'manager', 'viewer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Ungültige Rolle' });
    }

    // Create user
    const passwordHash = await hashPassword(password);
    const user = await createUser({
      email,
      passwordHash,
      name,
      role,
      emailVerified: 1, // Admin-created users are pre-verified
    });

    return res.status(201).json({
      user: toPublicUser(user),
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ error: 'Interner Serverfehler' });
  }
}
