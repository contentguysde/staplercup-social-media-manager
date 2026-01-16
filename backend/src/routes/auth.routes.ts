import { Router, Request, Response } from 'express';
import {
  findUserByEmail,
  findUserById,
  createUser,
  getAllUsers,
  deleteUser,
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  getRefreshTokenExpiry,
  saveRefreshToken,
  findRefreshToken,
  deleteRefreshToken,
  deleteUserRefreshTokens,
  toPublicUser,
  updateUserRole,
  updateUserName,
  verifyUserEmail,
  generateVerificationToken,
  getVerificationTokenExpiry,
  createVerificationToken,
  findVerificationToken,
  deleteVerificationToken,
} from '../services/auth.service';
import { sendVerificationEmail } from '../services/email.service';
import { config } from '../config/env';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.middleware';
import type { LoginRequest, RegisterRequest, Role } from '../types/auth';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as LoginRequest;

    if (!email || !password) {
      return res.status(400).json({ error: 'E-Mail und Passwort sind erforderlich' });
    }

    const user = findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    }

    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    }

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshToken = generateRefreshToken();
    const refreshTokenExpiry = getRefreshTokenExpiry();

    // Save refresh token
    saveRefreshToken({
      userId: user.id,
      token: refreshToken,
      expiresAt: refreshTokenExpiry.toISOString(),
    });

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return res.json({
      user: toPublicUser(user),
      accessToken,
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// POST /api/auth/register (Admin only)
router.post('/register', requireAuth, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, name, role = 'viewer' } = req.body as RegisterRequest;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'E-Mail, Passwort und Name sind erforderlich' });
    }

    // Check if user already exists
    const existingUser = findUserByEmail(email);
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
    const user = createUser({
      email,
      passwordHash,
      name,
      role,
    });

    return res.status(201).json({
      user: toPublicUser(user),
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ error: 'Kein Refresh-Token vorhanden' });
    }

    // Find and validate refresh token
    const storedToken = findRefreshToken(refreshToken);
    if (!storedToken) {
      return res.status(401).json({ error: 'Ungültiger Refresh-Token' });
    }

    // Check if token is expired
    if (new Date(storedToken.expires_at) < new Date()) {
      deleteRefreshToken(refreshToken);
      return res.status(401).json({ error: 'Refresh-Token abgelaufen' });
    }

    // Get user
    const user = findUserById(storedToken.user_id);
    if (!user) {
      deleteRefreshToken(refreshToken);
      return res.status(401).json({ error: 'Benutzer nicht gefunden' });
    }

    // Generate new access token
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Optionally rotate refresh token
    deleteRefreshToken(refreshToken);
    const newRefreshToken = generateRefreshToken();
    const refreshTokenExpiry = getRefreshTokenExpiry();

    saveRefreshToken({
      userId: user.id,
      token: newRefreshToken,
      expiresAt: refreshTokenExpiry.toISOString(),
    });

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      user: toPublicUser(user),
      accessToken,
    });
  } catch (error) {
    console.error('Refresh error:', error);
    return res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// POST /api/auth/logout
router.post('/logout', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (refreshToken) {
      deleteRefreshToken(refreshToken);
    }

    res.clearCookie('refreshToken');
    return res.json({ message: 'Erfolgreich abgemeldet' });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Nicht authentifiziert' });
    }

    const user = findUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    return res.json({ user: toPublicUser(user) });
  } catch (error) {
    console.error('Get me error:', error);
    return res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// GET /api/users (Admin only)
router.get('/users', requireAuth, requireRole('admin'), (_req: AuthRequest, res: Response) => {
  try {
    const users = getAllUsers();
    return res.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    return res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// DELETE /api/users/:id (Admin only)
router.delete('/users/:id', requireAuth, requireRole('admin'), (req: AuthRequest, res: Response) => {
  try {
    const userId = parseInt(req.params.id, 10);

    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Ungültige Benutzer-ID' });
    }

    // Prevent self-deletion
    if (req.user?.userId === userId) {
      return res.status(400).json({ error: 'Sie können sich nicht selbst löschen' });
    }

    // Delete user's refresh tokens first
    deleteUserRefreshTokens(userId);

    // Delete user
    const deleted = deleteUser(userId);
    if (!deleted) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    return res.json({ message: 'Benutzer erfolgreich gelöscht' });
  } catch (error) {
    console.error('Delete user error:', error);
    return res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// PUT /api/users/:id/role (Admin only)
router.put('/users/:id/role', requireAuth, requireRole('admin'), (req: AuthRequest, res: Response) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { role } = req.body as { role: Role };

    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Ungültige Benutzer-ID' });
    }

    // Validate role
    const validRoles: Role[] = ['admin', 'manager', 'viewer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Ungültige Rolle' });
    }

    // Prevent changing own role
    if (req.user?.userId === userId) {
      return res.status(400).json({ error: 'Sie können Ihre eigene Rolle nicht ändern' });
    }

    const updated = updateUserRole(userId, role);
    if (!updated) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    const user = findUserById(userId);
    return res.json({ user: user ? toPublicUser(user) : null });
  } catch (error) {
    console.error('Update role error:', error);
    return res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// PUT /api/users/:id/name (Admin only)
router.put('/users/:id/name', requireAuth, requireRole('admin'), (req: AuthRequest, res: Response) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { name } = req.body as { name: string };

    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Ungültige Benutzer-ID' });
    }

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Name ist erforderlich' });
    }

    const updated = updateUserName(userId, name.trim());
    if (!updated) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    const user = findUserById(userId);
    return res.json({ user: user ? toPublicUser(user) : null });
  } catch (error) {
    console.error('Update name error:', error);
    return res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// POST /api/auth/register-public (Self-registration with email verification)
router.post('/register-public', async (req: Request, res: Response) => {
  try {
    // Check if registration is enabled
    if (!config.registrationEnabled) {
      return res.status(403).json({ error: 'Registrierung ist deaktiviert' });
    }

    const { email, password, name } = req.body as RegisterRequest;

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
    const existingUser = findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'Ein Benutzer mit dieser E-Mail existiert bereits' });
    }

    // Generate verification token and hash password
    const verificationToken = generateVerificationToken();
    const passwordHash = await hashPassword(password);
    const expiresAt = getVerificationTokenExpiry();

    // Store pending registration
    createVerificationToken({
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
});

// GET /api/auth/verify-email
router.get('/verify-email', async (req: Request, res: Response) => {
  try {
    const { token } = req.query as { token: string };

    if (!token) {
      return res.status(400).json({ error: 'Verifizierungstoken fehlt' });
    }

    // Find verification token
    const verificationData = findVerificationToken(token);
    if (!verificationData) {
      return res.status(400).json({ error: 'Ungültiger oder abgelaufener Verifizierungstoken' });
    }

    // Check if token is expired
    if (new Date(verificationData.expires_at) < new Date()) {
      deleteVerificationToken(token);
      return res.status(400).json({ error: 'Verifizierungstoken ist abgelaufen' });
    }

    // Check if user already exists (edge case: user registered via admin in the meantime)
    const existingUser = findUserByEmail(verificationData.email);
    if (existingUser) {
      deleteVerificationToken(token);
      return res.status(409).json({ error: 'Ein Benutzer mit dieser E-Mail existiert bereits' });
    }

    // Create the user
    const user = createUser({
      email: verificationData.email,
      passwordHash: verificationData.password_hash,
      name: verificationData.name,
      role: 'viewer', // New users always start as viewers
      emailVerified: 1,
    });

    // Delete verification token
    deleteVerificationToken(token);

    return res.json({
      message: 'E-Mail erfolgreich verifiziert. Sie können sich jetzt anmelden.',
      user: toPublicUser(user),
    });
  } catch (error) {
    console.error('Verify email error:', error);
    return res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// GET /api/auth/registration-enabled (Check if registration is enabled)
router.get('/registration-enabled', (_req: Request, res: Response) => {
  return res.json({ enabled: config.registrationEnabled });
});

export default router;
