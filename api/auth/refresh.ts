import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  findRefreshToken,
  deleteRefreshToken,
  saveRefreshToken,
  findUserById,
} from '../_lib/db';
import {
  generateAccessToken,
  generateRefreshToken,
  getRefreshTokenExpiry,
  toPublicUser,
  parseCookies,
} from '../_lib/auth';
import { serialize } from 'cookie';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const cookies = parseCookies(req.headers.cookie);
    const refreshToken = cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ error: 'Kein Refresh-Token vorhanden' });
    }

    // Find and validate refresh token
    const storedToken = await findRefreshToken(refreshToken);
    if (!storedToken) {
      return res.status(401).json({ error: 'Ungültiger Refresh-Token' });
    }

    // Check if token is expired
    if (new Date(storedToken.expires_at) < new Date()) {
      await deleteRefreshToken(refreshToken);
      return res.status(401).json({ error: 'Refresh-Token abgelaufen' });
    }

    // Get user
    const user = await findUserById(storedToken.user_id);
    if (!user) {
      await deleteRefreshToken(refreshToken);
      return res.status(401).json({ error: 'Benutzer nicht gefunden' });
    }

    // Generate new access token
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Rotate refresh token
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
  } catch (error) {
    console.error('Refresh error:', error);
    return res.status(500).json({ error: 'Interner Serverfehler' });
  }
}
