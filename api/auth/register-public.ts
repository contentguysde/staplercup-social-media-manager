import type { VercelRequest, VercelResponse } from '@vercel/node';
import { findUserByEmail, createVerificationToken } from '../_lib/db';
import {
  hashPassword,
  generateVerificationToken,
  getVerificationTokenExpiry,
} from '../_lib/auth';
import { sendVerificationEmail } from '../_lib/email';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check if registration is enabled
    if (process.env.REGISTRATION_ENABLED === 'false') {
      return res.status(403).json({ error: 'Registrierung ist deaktiviert' });
    }

    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'E-Mail, Passwort und Name sind erforderlich' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Ungültiges E-Mail-Format' });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({ error: 'Das Passwort muss mindestens 8 Zeichen lang sein' });
    }

    // Check if user already exists
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'Ein Benutzer mit dieser E-Mail existiert bereits' });
    }

    // Generate verification token and hash password
    const verificationToken = generateVerificationToken();
    const passwordHash = await hashPassword(password);
    const expiresAt = getVerificationTokenExpiry();

    // Store pending registration
    await createVerificationToken({
      email,
      token: verificationToken,
      name,
      passwordHash,
      expiresAt: expiresAt.toISOString(),
    });

    // Send verification email
    const emailSent = await sendVerificationEmail(email, name, verificationToken);

    if (!emailSent) {
      return res.status(500).json({
        error: 'E-Mail konnte nicht gesendet werden. Bitte versuchen Sie es später erneut.',
      });
    }

    return res.status(201).json({
      message: 'Registrierung erfolgreich. Bitte überprüfen Sie Ihre E-Mail, um Ihr Konto zu bestätigen.',
    });
  } catch (error) {
    console.error('Public register error:', error);
    return res.status(500).json({ error: 'Interner Serverfehler' });
  }
}
