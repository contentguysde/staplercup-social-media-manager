import { sql } from '@vercel/postgres';
import type { User, RefreshToken, VerificationToken } from './types';

export type { User, RefreshToken, VerificationToken };

// Initialize database schema
export async function initDatabase() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'viewer',
      email_verified INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token VARCHAR(255) UNIQUE NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      token VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  // Interaction metadata for read/archive status
  await sql`
    CREATE TABLE IF NOT EXISTS interaction_metadata (
      id SERIAL PRIMARY KEY,
      interaction_id VARCHAR(255) UNIQUE NOT NULL,
      is_read INTEGER DEFAULT 0,
      is_archived INTEGER DEFAULT 0,
      read_at TIMESTAMP,
      archived_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
}

// Interaction metadata types
export interface InteractionMetadata {
  id: number;
  interaction_id: string;
  is_read: number;
  is_archived: number;
  read_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

// User operations
export async function findUserByEmail(email: string): Promise<User | null> {
  const result = await sql`SELECT * FROM users WHERE email = ${email}`;
  return (result.rows[0] as User) || null;
}

export async function findUserById(id: number): Promise<User | null> {
  const result = await sql`SELECT * FROM users WHERE id = ${id}`;
  return (result.rows[0] as User) || null;
}

export async function createUser(params: {
  email: string;
  passwordHash: string;
  name: string;
  role: string;
  emailVerified?: number;
}): Promise<User> {
  const result = await sql`
    INSERT INTO users (email, password_hash, name, role, email_verified)
    VALUES (${params.email}, ${params.passwordHash}, ${params.name}, ${params.role}, ${params.emailVerified || 0})
    RETURNING *
  `;
  return result.rows[0] as User;
}

export async function getAllUsers() {
  const result = await sql`
    SELECT id, email, name, role, email_verified, created_at, updated_at
    FROM users ORDER BY created_at DESC
  `;
  return result.rows;
}

export async function deleteUser(id: number) {
  const result = await sql`DELETE FROM users WHERE id = ${id}`;
  return (result.rowCount ?? 0) > 0;
}

export async function getUserCount() {
  const result = await sql`SELECT COUNT(*) as count FROM users`;
  return parseInt(result.rows[0].count, 10);
}

export async function updateUserRole(id: number, role: string) {
  const result = await sql`
    UPDATE users SET role = ${role}, updated_at = CURRENT_TIMESTAMP WHERE id = ${id}
  `;
  return (result.rowCount ?? 0) > 0;
}

export async function updateUserName(id: number, name: string) {
  const result = await sql`
    UPDATE users SET name = ${name}, updated_at = CURRENT_TIMESTAMP WHERE id = ${id}
  `;
  return (result.rowCount ?? 0) > 0;
}

export async function verifyUserEmail(id: number) {
  const result = await sql`
    UPDATE users SET email_verified = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ${id}
  `;
  return (result.rowCount ?? 0) > 0;
}

// Refresh token operations
export async function saveRefreshToken(params: {
  userId: number;
  token: string;
  expiresAt: string;
}) {
  await sql`
    INSERT INTO refresh_tokens (user_id, token, expires_at)
    VALUES (${params.userId}, ${params.token}, ${params.expiresAt})
  `;
}

export async function findRefreshToken(token: string): Promise<RefreshToken | null> {
  const result = await sql`SELECT * FROM refresh_tokens WHERE token = ${token}`;
  return (result.rows[0] as RefreshToken) || null;
}

export async function deleteRefreshToken(token: string) {
  const result = await sql`DELETE FROM refresh_tokens WHERE token = ${token}`;
  return (result.rowCount ?? 0) > 0;
}

export async function deleteUserRefreshTokens(userId: number) {
  await sql`DELETE FROM refresh_tokens WHERE user_id = ${userId}`;
}

export async function cleanupExpiredTokens() {
  await sql`DELETE FROM refresh_tokens WHERE expires_at < CURRENT_TIMESTAMP`;
}

// Verification token operations
export async function createVerificationToken(params: {
  email: string;
  token: string;
  name: string;
  passwordHash: string;
  expiresAt: string;
}) {
  await sql`DELETE FROM email_verification_tokens WHERE email = ${params.email}`;
  await sql`
    INSERT INTO email_verification_tokens (email, token, name, password_hash, expires_at)
    VALUES (${params.email}, ${params.token}, ${params.name}, ${params.passwordHash}, ${params.expiresAt})
  `;
}

export async function findVerificationToken(token: string): Promise<VerificationToken | null> {
  const result = await sql`SELECT * FROM email_verification_tokens WHERE token = ${token}`;
  return (result.rows[0] as VerificationToken) || null;
}

export async function deleteVerificationToken(token: string) {
  const result = await sql`DELETE FROM email_verification_tokens WHERE token = ${token}`;
  return (result.rowCount ?? 0) > 0;
}

export async function cleanupExpiredVerificationTokens() {
  await sql`DELETE FROM email_verification_tokens WHERE expires_at < CURRENT_TIMESTAMP`;
}

// Interaction metadata operations
export async function getInteractionMetadata(interactionId: string): Promise<InteractionMetadata | null> {
  const result = await sql`SELECT * FROM interaction_metadata WHERE interaction_id = ${interactionId}`;
  return (result.rows[0] as InteractionMetadata) || null;
}

export async function getAllInteractionMetadata(): Promise<InteractionMetadata[]> {
  const result = await sql`SELECT * FROM interaction_metadata`;
  return result.rows as InteractionMetadata[];
}

export async function getArchivedInteractionIds(): Promise<string[]> {
  const result = await sql`SELECT interaction_id FROM interaction_metadata WHERE is_archived = 1`;
  return result.rows.map((row) => (row as { interaction_id: string }).interaction_id);
}

export async function getReadInteractionIds(): Promise<string[]> {
  const result = await sql`SELECT interaction_id FROM interaction_metadata WHERE is_read = 1`;
  return result.rows.map((row) => (row as { interaction_id: string }).interaction_id);
}

export async function markInteractionAsRead(interactionId: string): Promise<InteractionMetadata> {
  // Upsert: insert if not exists, update if exists
  const existing = await getInteractionMetadata(interactionId);

  if (existing) {
    await sql`
      UPDATE interaction_metadata
      SET is_read = 1, read_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE interaction_id = ${interactionId}
    `;
  } else {
    await sql`
      INSERT INTO interaction_metadata (interaction_id, is_read, read_at)
      VALUES (${interactionId}, 1, CURRENT_TIMESTAMP)
    `;
  }

  return (await getInteractionMetadata(interactionId))!;
}

export async function markInteractionAsUnread(interactionId: string): Promise<InteractionMetadata> {
  const existing = await getInteractionMetadata(interactionId);

  if (existing) {
    await sql`
      UPDATE interaction_metadata
      SET is_read = 0, read_at = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE interaction_id = ${interactionId}
    `;
  } else {
    await sql`
      INSERT INTO interaction_metadata (interaction_id, is_read)
      VALUES (${interactionId}, 0)
    `;
  }

  return (await getInteractionMetadata(interactionId))!;
}

export async function archiveInteraction(interactionId: string): Promise<InteractionMetadata> {
  const existing = await getInteractionMetadata(interactionId);

  if (existing) {
    await sql`
      UPDATE interaction_metadata
      SET is_archived = 1, archived_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE interaction_id = ${interactionId}
    `;
  } else {
    await sql`
      INSERT INTO interaction_metadata (interaction_id, is_archived, archived_at)
      VALUES (${interactionId}, 1, CURRENT_TIMESTAMP)
    `;
  }

  return (await getInteractionMetadata(interactionId))!;
}

export async function unarchiveInteraction(interactionId: string): Promise<InteractionMetadata> {
  const existing = await getInteractionMetadata(interactionId);

  if (existing) {
    await sql`
      UPDATE interaction_metadata
      SET is_archived = 0, archived_at = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE interaction_id = ${interactionId}
    `;
  } else {
    await sql`
      INSERT INTO interaction_metadata (interaction_id, is_archived)
      VALUES (${interactionId}, 0)
    `;
  }

  return (await getInteractionMetadata(interactionId))!;
}
