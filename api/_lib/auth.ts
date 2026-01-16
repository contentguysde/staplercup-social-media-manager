import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const SALT_ROUNDS = 12;

export type Role = 'admin' | 'manager' | 'viewer';

export interface TokenPayload {
  userId: number;
  email: string;
  role: Role;
}

export interface User {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  role: Role;
  email_verified: number;
  created_at: string;
  updated_at: string;
}

export interface UserPublic {
  id: number;
  email: string;
  name: string;
  role: Role;
  email_verified: number;
  created_at: string;
  updated_at: string;
}

// Helper to convert User to UserPublic (removes password_hash)
export function toPublicUser(user: User): UserPublic {
  const { password_hash, ...publicUser } = user;
  return publicUser;
}

// Password hashing
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// JWT Token generation
export function generateAccessToken(payload: TokenPayload): string {
  const secret = process.env.JWT_SECRET || 'default-secret-change-in-production';
  const expiresIn = process.env.JWT_EXPIRES_IN || '15m';
  return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): TokenPayload {
  const secret = process.env.JWT_SECRET || 'default-secret-change-in-production';
  return jwt.verify(token, secret) as TokenPayload;
}

// Refresh token generation
export function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString('hex');
}

export function getRefreshTokenExpiry(): Date {
  const days = parseInt(process.env.REFRESH_TOKEN_EXPIRES_IN?.replace('d', '') || '7', 10);
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + days);
  return expiry;
}

// Email verification token
export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function getVerificationTokenExpiry(): Date {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + 24);
  return expiry;
}

// Parse Authorization header
export function getTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

// Parse cookies
export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;

  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.split('=');
    if (name && rest.length > 0) {
      cookies[name.trim()] = rest.join('=').trim();
    }
  });

  return cookies;
}
