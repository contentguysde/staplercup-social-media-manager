import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { userStatements, tokenStatements, verificationStatements } from '../database/db';
import { env } from '../config/env';
import type {
  User,
  UserPublic,
  Role,
  TokenPayload,
  CreateUserParams,
  CreateTokenParams,
} from '../types/auth';

const SALT_ROUNDS = 12;

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
  const expiresIn = env.JWT_EXPIRES_IN || '15m';
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
}

// Refresh token generation
export function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString('hex');
}

export function getRefreshTokenExpiry(): Date {
  const days = parseInt(env.REFRESH_TOKEN_EXPIRES_IN?.replace('d', '') || '7', 10);
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + days);
  return expiry;
}

// User operations
export function findUserByEmail(email: string): User | undefined {
  return userStatements.findByEmail.get(email) as User | undefined;
}

export function findUserById(id: number): User | undefined {
  return userStatements.findById.get(id) as User | undefined;
}

export function createUser(params: CreateUserParams): User {
  const result = userStatements.create.run(params);
  return findUserById(result.lastInsertRowid as number) as User;
}

export function getAllUsers(): UserPublic[] {
  return userStatements.findAll.all() as UserPublic[];
}

export function deleteUser(id: number): boolean {
  const result = userStatements.delete.run(id);
  return result.changes > 0;
}

export function getUserCount(): number {
  const result = userStatements.count.get() as { count: number };
  return result.count;
}

// Refresh token operations
export function saveRefreshToken(params: CreateTokenParams): void {
  tokenStatements.create.run({
    userId: params.userId,
    token: params.token,
    expiresAt: params.expiresAt,
  });
}

export function findRefreshToken(token: string): { user_id: number; expires_at: string } | undefined {
  return tokenStatements.findByToken.get(token) as { user_id: number; expires_at: string } | undefined;
}

export function deleteRefreshToken(token: string): boolean {
  const result = tokenStatements.deleteByToken.run(token);
  return result.changes > 0;
}

export function deleteUserRefreshTokens(userId: number): void {
  tokenStatements.deleteByUserId.run(userId);
}

export function cleanupExpiredTokens(): void {
  tokenStatements.deleteExpired.run();
}

// Update user operations
export function updateUserRole(id: number, role: Role): boolean {
  const result = userStatements.updateRole.run({ id, role });
  return result.changes > 0;
}

export function updateUserName(id: number, name: string): boolean {
  const result = userStatements.updateName.run({ id, name });
  return result.changes > 0;
}

export function verifyUserEmail(id: number): boolean {
  const result = userStatements.verifyEmail.run({ id });
  return result.changes > 0;
}

// Email verification token operations
export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function getVerificationTokenExpiry(): Date {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + 24); // 24 hours validity
  return expiry;
}

export function createVerificationToken(params: {
  email: string;
  token: string;
  name: string;
  passwordHash: string;
  expiresAt: string;
}): void {
  // Delete any existing tokens for this email first
  verificationStatements.deleteByEmail.run(params.email);
  verificationStatements.create.run(params);
}

export function findVerificationToken(token: string): {
  email: string;
  name: string;
  password_hash: string;
  expires_at: string;
} | undefined {
  return verificationStatements.findByToken.get(token) as {
    email: string;
    name: string;
    password_hash: string;
    expires_at: string;
  } | undefined;
}

export function deleteVerificationToken(token: string): boolean {
  const result = verificationStatements.deleteByToken.run(token);
  return result.changes > 0;
}

export function cleanupExpiredVerificationTokens(): void {
  verificationStatements.deleteExpired.run();
}

// Create initial admin user if no users exist
export async function createInitialAdmin(): Promise<void> {
  const userCount = getUserCount();

  if (userCount === 0 && env.ADMIN_EMAIL && env.ADMIN_PASSWORD) {
    const passwordHash = await hashPassword(env.ADMIN_PASSWORD);
    createUser({
      email: env.ADMIN_EMAIL,
      passwordHash,
      name: env.ADMIN_NAME || 'Admin',
      role: 'admin',
      emailVerified: 1, // Admin is pre-verified
    });
    console.log(`Initial admin user created: ${env.ADMIN_EMAIL}`);
  }
}
