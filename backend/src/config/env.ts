import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3001', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  // Meta/Instagram
  meta: {
    appId: process.env.META_APP_ID || '',
    appSecret: process.env.META_APP_SECRET || '',
    accessToken: process.env.META_ACCESS_TOKEN || '',
    instagramAccountId: process.env.INSTAGRAM_ACCOUNT_ID || '',
    graphApiVersion: 'v18.0',
    graphApiBaseUrl: 'https://graph.facebook.com',
    instagramApiBaseUrl: 'https://graph.instagram.com',
  },

  // AI Providers
  ai: {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    openaiModel: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
  },

  // Auth
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'change-this-in-production-to-a-secure-random-string',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  },

  // Database
  databasePath: process.env.DATABASE_PATH || path.join(__dirname, '../../data/staplercup.db'),

  // Initial Admin
  initialAdmin: {
    email: process.env.ADMIN_EMAIL || '',
    password: process.env.ADMIN_PASSWORD || '',
    name: process.env.ADMIN_NAME || 'Admin',
  },

  // Email
  email: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
    from: process.env.SMTP_FROM || '',
  },

  // Registration
  registrationEnabled: process.env.REGISTRATION_ENABLED !== 'false',
} as const;

// Export flat env object for easier access in services
export const env = {
  JWT_SECRET: config.auth.jwtSecret,
  JWT_EXPIRES_IN: config.auth.jwtExpiresIn,
  REFRESH_TOKEN_EXPIRES_IN: config.auth.refreshTokenExpiresIn,
  DATABASE_PATH: config.databasePath,
  ADMIN_EMAIL: config.initialAdmin.email,
  ADMIN_PASSWORD: config.initialAdmin.password,
  ADMIN_NAME: config.initialAdmin.name,
};

export function validateConfig(): void {
  const requiredEnvVars = [
    'META_ACCESS_TOKEN',
    'INSTAGRAM_ACCOUNT_ID',
  ];

  const missing = requiredEnvVars.filter(
    (varName) => !process.env[varName]
  );

  if (missing.length > 0) {
    console.warn(
      `Warning: Missing environment variables: ${missing.join(', ')}`
    );
  }
}
