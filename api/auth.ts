import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  findUserByEmail,
  findUserById,
  createUser,
  findRefreshToken,
  deleteRefreshToken,
  saveRefreshToken,
  createVerificationToken,
  findVerificationToken,
  deleteVerificationToken,
} from './_lib/db';
import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  getRefreshTokenExpiry,
  generateVerificationToken,
  getVerificationTokenExpiry,
  toPublicUser,
  getTokenFromHeader,
  parseCookies,
  Role,
} from './_lib/auth';
import { sendVerificationEmail } from './_lib/email';
import { serialize } from 'cookie';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Extract the action from the URL path
  // /api/auth/login -> action = "login"
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const action = pathParts[2] || ''; // ['api', 'auth', 'action']

  try {
    switch (action) {
      case 'login':
        return handleLogin(req, res);
      case 'logout':
        return handleLogout(req, res);
      case 'register':
        return handleRegister(req, res);
      case 'register-public':
        return handleRegisterPublic(req, res);
      case 'verify-email':
        return handleVerifyEmail(req, res);
      case 'refresh':
        return handleRefresh(req, res);
      case 'me':
        return handleMe(req, res);
      case 'registration-enabled':
        return handleRegistrationEnabled(req, res);
      default:
        return res.status(404).json({ error: 'Endpoint nicht gefunden' });
    }
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(500).json({ error: 'Interner Serverfehler' });
  }
}

// POST /api/auth/login
async function handleLogin(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'E-Mail und Passwort sind erforderlich' });
  }

  const user = await findUserByEmail(email);
  if (!user) {
    return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
  }

  const isValid = await verifyPassword(password, user.password_hash);
  if (!isValid) {
    return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
  }

  const accessToken = generateAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  const refreshToken = generateRefreshToken();
  const refreshTokenExpiry = getRefreshTokenExpiry();

  await saveRefreshToken({
    userId: user.id,
    token: refreshToken,
    expiresAt: refreshTokenExpiry.toISOString(),
  });

  res.setHeader('Set-Cookie', serialize('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  }));

  return res.status(200).json({
    user: toPublicUser(user),
    accessToken,
  });
}

// POST /api/auth/logout
async function handleLogout(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
}

// POST /api/auth/register (admin only)
async function handleRegister(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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

  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    return res.status(409).json({ error: 'Ein Benutzer mit dieser E-Mail existiert bereits' });
  }

  const validRoles: Role[] = ['admin', 'manager', 'viewer'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Ungültige Rolle' });
  }

  const passwordHash = await hashPassword(password);
  const user = await createUser({
    email,
    passwordHash,
    name,
    role,
    emailVerified: 1,
  });

  return res.status(201).json({
    user: toPublicUser(user),
  });
}

// POST /api/auth/register-public
async function handleRegisterPublic(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (process.env.REGISTRATION_ENABLED === 'false') {
    return res.status(403).json({ error: 'Registrierung ist deaktiviert' });
  }

  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'E-Mail, Passwort und Name sind erforderlich' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Ungültiges E-Mail-Format' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Das Passwort muss mindestens 8 Zeichen lang sein' });
  }

  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    return res.status(409).json({ error: 'Ein Benutzer mit dieser E-Mail existiert bereits' });
  }

  const verificationToken = generateVerificationToken();
  const passwordHash = await hashPassword(password);
  const expiresAt = getVerificationTokenExpiry();

  await createVerificationToken({
    email,
    token: verificationToken,
    name,
    passwordHash,
    expiresAt: expiresAt.toISOString(),
  });

  const emailSent = await sendVerificationEmail(email, name, verificationToken);

  if (!emailSent) {
    return res.status(500).json({
      error: 'E-Mail konnte nicht gesendet werden. Bitte versuchen Sie es später erneut.',
    });
  }

  return res.status(201).json({
    message: 'Registrierung erfolgreich. Bitte überprüfen Sie Ihre E-Mail, um Ihr Konto zu bestätigen.',
  });
}

// GET /api/auth/verify-email?token=xxx
async function handleVerifyEmail(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token } = req.query;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Verifizierungstoken fehlt' });
  }

  const verificationData = await findVerificationToken(token);
  if (!verificationData) {
    return res.status(400).json({ error: 'Ungültiger oder abgelaufener Verifizierungstoken' });
  }

  if (new Date(verificationData.expires_at) < new Date()) {
    await deleteVerificationToken(token);
    return res.status(400).json({ error: 'Verifizierungstoken ist abgelaufen' });
  }

  const existingUser = await findUserByEmail(verificationData.email);
  if (existingUser) {
    await deleteVerificationToken(token);
    return res.status(409).json({ error: 'Ein Benutzer mit dieser E-Mail existiert bereits' });
  }

  const user = await createUser({
    email: verificationData.email,
    passwordHash: verificationData.password_hash,
    name: verificationData.name,
    role: 'viewer',
    emailVerified: 1,
  });

  await deleteVerificationToken(token);

  return res.status(200).json({
    message: 'E-Mail erfolgreich verifiziert. Sie können sich jetzt anmelden.',
    user: toPublicUser(user),
  });
}

// POST /api/auth/refresh
async function handleRefresh(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cookies = parseCookies(req.headers.cookie);
  const refreshToken = cookies.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({ error: 'Kein Refresh-Token vorhanden' });
  }

  const storedToken = await findRefreshToken(refreshToken);
  if (!storedToken) {
    return res.status(401).json({ error: 'Ungültiger Refresh-Token' });
  }

  if (new Date(storedToken.expires_at) < new Date()) {
    await deleteRefreshToken(refreshToken);
    return res.status(401).json({ error: 'Refresh-Token abgelaufen' });
  }

  const user = await findUserById(storedToken.user_id);
  if (!user) {
    await deleteRefreshToken(refreshToken);
    return res.status(401).json({ error: 'Benutzer nicht gefunden' });
  }

  const accessToken = generateAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  await deleteRefreshToken(refreshToken);
  const newRefreshToken = generateRefreshToken();
  const refreshTokenExpiry = getRefreshTokenExpiry();

  await saveRefreshToken({
    userId: user.id,
    token: newRefreshToken,
    expiresAt: refreshTokenExpiry.toISOString(),
  });

  res.setHeader('Set-Cookie', serialize('refreshToken', newRefreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  }));

  return res.status(200).json({
    user: toPublicUser(user),
    accessToken,
  });
}

// GET /api/auth/me
async function handleMe(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
}

// GET /api/auth/registration-enabled
function handleRegistrationEnabled(_req: VercelRequest, res: VercelResponse) {
  const enabled = process.env.REGISTRATION_ENABLED !== 'false';
  return res.status(200).json({ enabled });
}
