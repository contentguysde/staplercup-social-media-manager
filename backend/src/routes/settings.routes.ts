import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { APIResponse } from '../types/index.js';
import { instagramService } from '../services/instagram.service.js';

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../../.env');

interface Settings {
  meta: {
    appId: string;
    appSecret: string;
    accessToken: string;
    instagramAccountId: string;
  };
  ai: {
    anthropicApiKey: string;
    openaiApiKey: string;
    openaiModel: string;
  };
}

// Available OpenAI models for chat completions
const OPENAI_CHAT_MODELS = [
  { id: 'gpt-4o', name: 'GPT-4o (neuestes, schnellstes)' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini (günstig, schnell)' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
  { id: 'gpt-4-turbo-preview', name: 'GPT-4 Turbo Preview' },
  { id: 'gpt-4', name: 'GPT-4 (klassisch)' },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo (schnell, günstig)' },
];

// Helper to read .env file
function readEnvFile(): Record<string, string> {
  try {
    if (!fs.existsSync(envPath)) {
      return {};
    }
    const content = fs.readFileSync(envPath, 'utf-8');
    const env: Record<string, string> = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key) {
          env[key] = valueParts.join('=');
        }
      }
    }
    return env;
  } catch {
    return {};
  }
}

// Helper to write .env file
function writeEnvFile(env: Record<string, string>): void {
  const lines = [
    '# Meta/Instagram API',
    `META_APP_ID=${env.META_APP_ID || ''}`,
    `META_APP_SECRET=${env.META_APP_SECRET || ''}`,
    `META_ACCESS_TOKEN=${env.META_ACCESS_TOKEN || ''}`,
    `INSTAGRAM_ACCOUNT_ID=${env.INSTAGRAM_ACCOUNT_ID || ''}`,
    '',
    '# AI Providers',
    `ANTHROPIC_API_KEY=${env.ANTHROPIC_API_KEY || ''}`,
    `OPENAI_API_KEY=${env.OPENAI_API_KEY || ''}`,
    `OPENAI_MODEL=${env.OPENAI_MODEL || 'gpt-4-turbo-preview'}`,
    '',
    '# Server Configuration',
    `PORT=${env.PORT || '3001'}`,
    `FRONTEND_URL=${env.FRONTEND_URL || 'http://localhost:5173'}`,
  ];
  fs.writeFileSync(envPath, lines.join('\n') + '\n');
}

// Mask sensitive values for display
function maskValue(value: string): string {
  if (!value || value.startsWith('your_')) return '';
  if (value.length <= 8) return '****';
  return value.substring(0, 4) + '****' + value.substring(value.length - 4);
}

// Get current settings (supports ?full=true for unmasked values)
router.get('/', async (req: Request, res: Response<APIResponse<Settings>>) => {
  try {
    const env = readEnvFile();
    const showFull = req.query.full === 'true';

    // Helper to get value (full or masked)
    const getValue = (value: string | undefined): string => {
      if (!value || value.startsWith('your_')) return '';
      return showFull ? value : maskValue(value);
    };

    const settings: Settings = {
      meta: {
        appId: getValue(env.META_APP_ID),
        appSecret: getValue(env.META_APP_SECRET),
        accessToken: getValue(env.META_ACCESS_TOKEN),
        instagramAccountId: getValue(env.INSTAGRAM_ACCOUNT_ID),
      },
      ai: {
        anthropicApiKey: getValue(env.ANTHROPIC_API_KEY),
        openaiApiKey: getValue(env.OPENAI_API_KEY),
        openaiModel: env.OPENAI_MODEL || 'gpt-4-turbo-preview',
      },
    };

    res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to read settings',
    });
  }
});

// Update settings
router.post('/', async (req: Request, res: Response<APIResponse<{ updated: boolean }>>) => {
  try {
    const { meta, ai } = req.body as Partial<Settings>;
    const env = readEnvFile();

    // Only update values that are provided and not empty
    if (meta?.appId) env.META_APP_ID = meta.appId;
    if (meta?.appSecret) env.META_APP_SECRET = meta.appSecret;
    if (meta?.accessToken) env.META_ACCESS_TOKEN = meta.accessToken;
    if (meta?.instagramAccountId) env.INSTAGRAM_ACCOUNT_ID = meta.instagramAccountId;

    if (ai?.anthropicApiKey) env.ANTHROPIC_API_KEY = ai.anthropicApiKey;
    if (ai?.openaiApiKey) env.OPENAI_API_KEY = ai.openaiApiKey;
    if (ai?.openaiModel) env.OPENAI_MODEL = ai.openaiModel;

    writeEnvFile(env);

    res.json({
      success: true,
      data: { updated: true },
      message: 'Settings saved. Restart the server to apply changes.',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save settings',
    });
  }
});

// Get available OpenAI models
router.get('/openai-models', async (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: OPENAI_CHAT_MODELS,
  });
});

// Test Instagram connection
router.post('/test/instagram', async (_req: Request, res: Response) => {
  try {
    const env = readEnvFile();
    const accessToken = env.META_ACCESS_TOKEN;
    const accountId = env.INSTAGRAM_ACCOUNT_ID;

    if (!accessToken || !accountId) {
      res.json({
        success: false,
        error: 'Missing Instagram credentials',
      });
      return;
    }

    // Try Facebook Graph API first (for Business accounts with Page token)
    let response = await fetch(
      `https://graph.facebook.com/v18.0/${accountId}?fields=id,username&access_token=${accessToken}`
    );
    let data = await response.json();

    // If that fails, try Instagram Basic Display API (graph.instagram.com)
    if (data.error) {
      response = await fetch(
        `https://graph.instagram.com/me?fields=id,username&access_token=${accessToken}`
      );
      data = await response.json();
    }

    if (data.error) {
      res.json({
        success: false,
        error: data.error.message,
      });
      return;
    }

    res.json({
      success: true,
      data: {
        connected: true,
        username: data.username,
        accountId: data.id,
      },
    });
  } catch (error) {
    res.json({
      success: false,
      error: error instanceof Error ? error.message : 'Connection test failed',
    });
  }
});

// Test OpenAI connection
router.post('/test/openai', async (_req: Request, res: Response) => {
  try {
    const env = readEnvFile();
    const apiKey = env.OPENAI_API_KEY;

    if (!apiKey || apiKey === 'your_openai_api_key') {
      res.json({
        success: false,
        error: 'Kein OpenAI API Key konfiguriert',
      });
      return;
    }

    // Test with a simple models list request
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });
    const data = await response.json();

    if (data.error) {
      res.json({
        success: false,
        error: data.error.message,
      });
      return;
    }

    res.json({
      success: true,
      data: {
        connected: true,
        models: data.data?.length || 0,
      },
    });
  } catch (error) {
    res.json({
      success: false,
      error: error instanceof Error ? error.message : 'Connection test failed',
    });
  }
});

// Test Anthropic connection
router.post('/test/anthropic', async (_req: Request, res: Response) => {
  try {
    const env = readEnvFile();
    const apiKey = env.ANTHROPIC_API_KEY;

    if (!apiKey || apiKey === 'your_anthropic_api_key') {
      res.json({
        success: false,
        error: 'Kein Anthropic API Key konfiguriert',
      });
      return;
    }

    // Test with a minimal message request
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }],
      }),
    });
    const data = await response.json();

    if (data.error) {
      res.json({
        success: false,
        error: data.error.message,
      });
      return;
    }

    res.json({
      success: true,
      data: {
        connected: true,
        model: data.model,
      },
    });
  } catch (error) {
    res.json({
      success: false,
      error: error instanceof Error ? error.message : 'Connection test failed',
    });
  }
});

// Get token info (expiration date, validity)
router.get('/token-info', async (_req: Request, res: Response) => {
  try {
    const env = readEnvFile();
    const accessToken = env.META_ACCESS_TOKEN;

    if (!accessToken || accessToken.startsWith('your_')) {
      res.json({
        success: false,
        error: 'Kein Access Token konfiguriert',
      });
      return;
    }

    const tokenInfo = await instagramService.getTokenInfo(accessToken);

    res.json({
      success: true,
      data: {
        isValid: tokenInfo.isValid,
        expiresAt: tokenInfo.expiresAt?.toISOString() || null,
        scopes: tokenInfo.scopes,
        daysUntilExpiry: tokenInfo.expiresAt
          ? Math.ceil((tokenInfo.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : null,
      },
    });
  } catch (error) {
    res.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get token info',
    });
  }
});

// Exchange short-lived token for long-lived token
router.post('/exchange-token', async (req: Request, res: Response) => {
  try {
    const env = readEnvFile();
    const { shortLivedToken } = req.body;

    // Use provided token or current token
    const tokenToExchange = shortLivedToken || env.META_ACCESS_TOKEN;

    if (!tokenToExchange || tokenToExchange.startsWith('your_')) {
      res.json({
        success: false,
        error: 'Kein Token zum Austauschen vorhanden',
      });
      return;
    }

    if (!env.META_APP_ID || !env.META_APP_SECRET) {
      res.json({
        success: false,
        error: 'App ID und App Secret müssen konfiguriert sein',
      });
      return;
    }

    const tokenInfo = await instagramService.exchangeForLongLivedToken(tokenToExchange);

    // Save the new token to .env
    env.META_ACCESS_TOKEN = tokenInfo.accessToken;
    writeEnvFile(env);

    // Update the service with the new token
    instagramService.updateAccessToken(tokenInfo.accessToken);

    const expiresAt = new Date(Date.now() + tokenInfo.expiresIn * 1000);

    res.json({
      success: true,
      data: {
        accessToken: tokenInfo.accessToken.substring(0, 10) + '...',
        expiresAt: expiresAt.toISOString(),
        expiresIn: tokenInfo.expiresIn,
        daysUntilExpiry: Math.ceil(tokenInfo.expiresIn / (60 * 60 * 24)),
      },
      message: 'Token erfolgreich in Long-Lived Token umgewandelt!',
    });
  } catch (error: any) {
    const errorMessage = error?.response?.data?.error?.message || error?.message || 'Token-Austausch fehlgeschlagen';
    res.json({
      success: false,
      error: errorMessage,
    });
  }
});

// Refresh existing long-lived token
router.post('/refresh-token', async (_req: Request, res: Response) => {
  try {
    const env = readEnvFile();
    const currentToken = env.META_ACCESS_TOKEN;

    if (!currentToken || currentToken.startsWith('your_')) {
      res.json({
        success: false,
        error: 'Kein Token zum Erneuern vorhanden',
      });
      return;
    }

    if (!env.META_APP_ID || !env.META_APP_SECRET) {
      res.json({
        success: false,
        error: 'App ID und App Secret müssen konfiguriert sein',
      });
      return;
    }

    const tokenInfo = await instagramService.refreshLongLivedToken(currentToken);

    // Save the new token to .env
    env.META_ACCESS_TOKEN = tokenInfo.accessToken;
    writeEnvFile(env);

    // Update the service with the new token
    instagramService.updateAccessToken(tokenInfo.accessToken);

    const expiresAt = new Date(Date.now() + tokenInfo.expiresIn * 1000);

    res.json({
      success: true,
      data: {
        accessToken: tokenInfo.accessToken.substring(0, 10) + '...',
        expiresAt: expiresAt.toISOString(),
        expiresIn: tokenInfo.expiresIn,
        daysUntilExpiry: Math.ceil(tokenInfo.expiresIn / (60 * 60 * 24)),
      },
      message: 'Token erfolgreich erneuert! Gültig für weitere 60 Tage.',
    });
  } catch (error: any) {
    const errorMessage = error?.response?.data?.error?.message || error?.message || 'Token-Erneuerung fehlgeschlagen';
    res.json({
      success: false,
      error: errorMessage,
    });
  }
});

export default router;
