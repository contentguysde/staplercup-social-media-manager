import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config, validateConfig } from './config/env.js';
import { initializeDatabase } from './database/db.js';
import { createInitialAdmin, cleanupExpiredTokens } from './services/auth.service.js';
import { requireAuth, requireRole } from './middleware/auth.middleware.js';
import authRoutes from './routes/auth.routes.js';
import instagramRoutes from './routes/instagram.routes.js';
import aiRoutes from './routes/ai.routes.js';
import settingsRoutes from './routes/settings.routes.js';

// Validate configuration
validateConfig();

// Initialize database
initializeDatabase();

const app = express();

// Middleware
app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Auth routes (unprotected login/refresh, protected register/logout)
app.use('/api/auth', authRoutes);

// Protected routes
app.use('/api/instagram', requireAuth, instagramRoutes);
app.use('/api/ai', requireAuth, aiRoutes);
app.use('/api/settings', requireAuth, requireRole('admin'), settingsRoutes);

// Health check (unprotected)
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    message: 'StaplerCup Social Media API is running',
    timestamp: new Date().toISOString(),
  });
});

// Error handling
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

// Start server
async function startServer() {
  // Create initial admin user if needed
  await createInitialAdmin();

  // Cleanup expired refresh tokens periodically (every hour)
  setInterval(() => {
    cleanupExpiredTokens();
  }, 60 * 60 * 1000);

  app.listen(config.port, () => {
    console.log(`Server running on http://localhost:${config.port}`);
    console.log(`Instagram API: http://localhost:${config.port}/api/instagram`);
    console.log(`AI API: http://localhost:${config.port}/api/ai`);
    console.log(`Auth API: http://localhost:${config.port}/api/auth`);
  });
}

startServer();
