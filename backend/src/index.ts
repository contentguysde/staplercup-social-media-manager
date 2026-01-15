import express from 'express';
import cors from 'cors';
import { config, validateConfig } from './config/env.js';
import instagramRoutes from './routes/instagram.routes.js';
import aiRoutes from './routes/ai.routes.js';
import settingsRoutes from './routes/settings.routes.js';

// Validate configuration
validateConfig();

const app = express();

// Middleware
app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/instagram', instagramRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/settings', settingsRoutes);

// Health check
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
app.listen(config.port, () => {
  console.log(`🚀 Server running on http://localhost:${config.port}`);
  console.log(`📱 Instagram API: http://localhost:${config.port}/api/instagram`);
  console.log(`🤖 AI API: http://localhost:${config.port}/api/ai`);
});
