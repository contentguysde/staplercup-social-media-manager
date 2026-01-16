import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { env } from '../config/env';

const dbPath = env.DATABASE_PATH || path.join(__dirname, '../../data/staplercup.db');

// Ensure directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize schema immediately on load
function initSchema() {
  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'viewer',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Refresh tokens table
  db.exec(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for faster lookups
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id)
  `);

  // Email verification tokens table
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_verification_tokens_token ON email_verification_tokens(token)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_verification_tokens_email ON email_verification_tokens(email)
  `);

  // Add email_verified column to users if not exists
  try {
    db.exec(`ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0`);
  } catch {
    // Column already exists
  }
}

// Initialize schema before creating prepared statements
initSchema();

// Initialize database function (for logging purposes, schema already created)
export function initializeDatabase() {
  console.log('Database initialized successfully');
}

// Prepared statements for users (created after schema init)
export const userStatements = {
  findByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  findById: db.prepare('SELECT * FROM users WHERE id = ?'),
  create: db.prepare(`
    INSERT INTO users (email, password_hash, name, role, email_verified)
    VALUES (@email, @passwordHash, @name, @role, @emailVerified)
  `),
  updatePassword: db.prepare(`
    UPDATE users SET password_hash = @passwordHash, updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `),
  updateRole: db.prepare(`
    UPDATE users SET role = @role, updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `),
  updateName: db.prepare(`
    UPDATE users SET name = @name, updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `),
  verifyEmail: db.prepare(`
    UPDATE users SET email_verified = 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `),
  delete: db.prepare('DELETE FROM users WHERE id = ?'),
  findAll: db.prepare('SELECT id, email, name, role, email_verified, created_at, updated_at FROM users'),
  count: db.prepare('SELECT COUNT(*) as count FROM users'),
};

// Prepared statements for email verification
export const verificationStatements = {
  create: db.prepare(`
    INSERT INTO email_verification_tokens (email, token, name, password_hash, expires_at)
    VALUES (@email, @token, @name, @passwordHash, @expiresAt)
  `),
  findByToken: db.prepare('SELECT * FROM email_verification_tokens WHERE token = ?'),
  findByEmail: db.prepare('SELECT * FROM email_verification_tokens WHERE email = ?'),
  deleteByToken: db.prepare('DELETE FROM email_verification_tokens WHERE token = ?'),
  deleteByEmail: db.prepare('DELETE FROM email_verification_tokens WHERE email = ?'),
  deleteExpired: db.prepare("DELETE FROM email_verification_tokens WHERE expires_at < datetime('now')"),
};

// Prepared statements for refresh tokens
export const tokenStatements = {
  create: db.prepare(`
    INSERT INTO refresh_tokens (user_id, token, expires_at)
    VALUES (@userId, @token, @expiresAt)
  `),
  findByToken: db.prepare('SELECT * FROM refresh_tokens WHERE token = ?'),
  deleteByToken: db.prepare('DELETE FROM refresh_tokens WHERE token = ?'),
  deleteByUserId: db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?'),
  deleteExpired: db.prepare("DELETE FROM refresh_tokens WHERE expires_at < datetime('now')"),
};
