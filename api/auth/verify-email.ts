import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  findUserByEmail,
  createUser,
  findVerificationToken,
  deleteVerificationToken,
} from '../_lib/db';
import { toPublicUser } from '../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Verifizierungstoken fehlt' });
    }

    // Find verification token
    const verificationData = await findVerificationToken(token);
    if (!verificationData) {
      return res.status(400).json({ error: 'Ungültiger oder abgelaufener Verifizierungstoken' });
    }

    // Check if token is expired
    if (new Date(verificationData.expires_at) < new Date()) {
      await deleteVerificationToken(token);
      return res.status(400).json({ error: 'Verifizierungstoken ist abgelaufen' });
    }

    // Check if user already exists
    const existingUser = await findUserByEmail(verificationData.email);
    if (existingUser) {
      await deleteVerificationToken(token);
      return res.status(409).json({ error: 'Ein Benutzer mit dieser E-Mail existiert bereits' });
    }

    // Create the user
    const user = await createUser({
      email: verificationData.email,
      passwordHash: verificationData.password_hash,
      name: verificationData.name,
      role: 'viewer',
      emailVerified: 1,
    });

    // Delete verification token
    await deleteVerificationToken(token);

    return res.status(200).json({
      message: 'E-Mail erfolgreich verifiziert. Sie können sich jetzt anmelden.',
      user: toPublicUser(user),
    });
  } catch (error) {
    console.error('Verify email error:', error);
    return res.status(500).json({ error: 'Interner Serverfehler' });
  }
}
