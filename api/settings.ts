import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAccessToken, getTokenFromHeader } from './_lib/auth';
import axios from 'axios';

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
  { id: 'gpt-4', name: 'GPT-4 (klassisch)' },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo (schnell, günstig)' },
];

// Mask sensitive values for display
function maskValue(value: string | undefined): string {
  if (!value || value.startsWith('your_')) return '';
  if (value.length <= 8) return '****';
  return value.substring(0, 4) + '****' + value.substring(value.length - 4);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle OPTIONS preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Verify authentication for all settings operations
  const token = getTokenFromHeader(req.headers.authorization as string);
  if (!token) {
    return res.status(401).json({ error: 'Nicht authentifiziert' });
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    return res.status(401).json({ error: 'Ungültiger Token' });
  }

  // Only admins can access settings
  if (payload.role !== 'admin') {
    return res.status(403).json({ error: 'Keine Berechtigung' });
  }

  // Extract the action from query parameter (set by Vercel rewrite)
  const action = (req.query.action as string) || '';

  try {
    // GET /api/settings - Get current settings
    if (req.method === 'GET' && !action) {
      return handleGetSettings(req, res);
    }

    // POST /api/settings - Update settings (not supported in serverless)
    if (req.method === 'POST' && !action) {
      return res.status(200).json({
        success: true,
        data: { updated: false },
        message: 'Einstellungen können nur über das Vercel Dashboard geändert werden.',
      });
    }

    // GET /api/settings/openai-models
    if (req.method === 'GET' && action === 'openai-models') {
      return res.status(200).json({
        success: true,
        data: OPENAI_CHAT_MODELS,
      });
    }

    // POST /api/settings/test/instagram
    if (req.method === 'POST' && action === 'test/instagram') {
      return handleTestInstagram(res);
    }

    // POST /api/settings/test/openai
    if (req.method === 'POST' && action === 'test/openai') {
      return handleTestOpenAI(res);
    }

    // POST /api/settings/test/anthropic
    if (req.method === 'POST' && action === 'test/anthropic') {
      return handleTestAnthropic(res);
    }

    // GET /api/settings/token-info
    if (req.method === 'GET' && action === 'token-info') {
      return handleGetTokenInfo(res);
    }

    // POST /api/settings/exchange-token
    if (req.method === 'POST' && action === 'exchange-token') {
      return res.status(200).json({
        success: false,
        error: 'Token-Austausch ist in der Serverless-Umgebung nicht verfügbar. Bitte verwenden Sie das Vercel Dashboard.',
      });
    }

    // POST /api/settings/refresh-token
    if (req.method === 'POST' && action === 'refresh-token') {
      return res.status(200).json({
        success: false,
        error: 'Token-Erneuerung ist in der Serverless-Umgebung nicht verfügbar. Bitte verwenden Sie das Vercel Dashboard.',
      });
    }

    return res.status(404).json({ error: 'Endpoint nicht gefunden' });
  } catch (error) {
    console.error('Settings error:', error);
    return res.status(500).json({ error: 'Interner Serverfehler' });
  }
}

// GET /api/settings
function handleGetSettings(req: VercelRequest, res: VercelResponse) {
  const showFull = req.query.full === 'true';

  const getValue = (value: string | undefined): string => {
    if (!value || value.startsWith('your_')) return '';
    return showFull ? value : maskValue(value);
  };

  const settings: Settings = {
    meta: {
      appId: getValue(process.env.META_APP_ID),
      appSecret: getValue(process.env.META_APP_SECRET),
      accessToken: getValue(process.env.META_ACCESS_TOKEN),
      instagramAccountId: getValue(process.env.INSTAGRAM_ACCOUNT_ID),
    },
    ai: {
      anthropicApiKey: getValue(process.env.ANTHROPIC_API_KEY),
      openaiApiKey: getValue(process.env.OPENAI_API_KEY),
      openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    },
  };

  return res.status(200).json({
    success: true,
    data: settings,
  });
}

// POST /api/settings/test/instagram
async function handleTestInstagram(res: VercelResponse) {
  const accessToken = process.env.META_ACCESS_TOKEN;
  const accountId = process.env.INSTAGRAM_ACCOUNT_ID;

  if (!accessToken || !accountId) {
    return res.status(200).json({
      success: false,
      error: 'Instagram-Zugangsdaten nicht konfiguriert',
    });
  }

  try {
    const response = await axios.get(
      `https://graph.instagram.com/v18.0/${accountId}`,
      {
        params: {
          fields: 'id,username',
          access_token: accessToken,
        },
      }
    );

    return res.status(200).json({
      success: true,
      data: {
        connected: true,
        username: response.data.username,
      },
    });
  } catch (error: any) {
    return res.status(200).json({
      success: false,
      error: error.response?.data?.error?.message || 'Verbindungstest fehlgeschlagen',
    });
  }
}

// POST /api/settings/test/openai
async function handleTestOpenAI(res: VercelResponse) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey || apiKey === 'your_openai_api_key') {
    return res.status(200).json({
      success: false,
      error: 'Kein OpenAI API Key konfiguriert',
    });
  }

  try {
    const response = await axios.get('https://api.openai.com/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        connected: true,
        models: response.data.data?.length || 0,
      },
    });
  } catch (error: any) {
    return res.status(200).json({
      success: false,
      error: error.response?.data?.error?.message || 'Verbindungstest fehlgeschlagen',
    });
  }
}

// POST /api/settings/test/anthropic
async function handleTestAnthropic(res: VercelResponse) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey || apiKey === 'your_anthropic_api_key') {
    return res.status(200).json({
      success: false,
      error: 'Kein Anthropic API Key konfiguriert',
    });
  }

  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-3-haiku-20240307',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }],
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
      }
    );

    return res.status(200).json({
      success: true,
      data: {
        connected: true,
        model: response.data.model,
      },
    });
  } catch (error: any) {
    return res.status(200).json({
      success: false,
      error: error.response?.data?.error?.message || 'Verbindungstest fehlgeschlagen',
    });
  }
}

// GET /api/settings/token-info
async function handleGetTokenInfo(res: VercelResponse) {
  const accessToken = process.env.META_ACCESS_TOKEN;

  if (!accessToken || accessToken.startsWith('your_')) {
    return res.status(200).json({
      success: false,
      error: 'Kein Access Token konfiguriert',
    });
  }

  try {
    // Use Facebook debug token endpoint
    const response = await axios.get(
      'https://graph.facebook.com/debug_token',
      {
        params: {
          input_token: accessToken,
          access_token: accessToken,
        },
      }
    );

    const data = response.data.data;

    if (!data.is_valid) {
      return res.status(200).json({
        success: true,
        data: {
          isValid: false,
          expiresAt: null,
          scopes: [],
          daysUntilExpiry: null,
        },
      });
    }

    const expiresAt = data.expires_at ? new Date(data.expires_at * 1000) : null;
    const daysUntilExpiry = expiresAt
      ? Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;

    return res.status(200).json({
      success: true,
      data: {
        isValid: true,
        expiresAt: expiresAt?.toISOString() || null,
        scopes: data.scopes || [],
        daysUntilExpiry,
      },
    });
  } catch (error: any) {
    return res.status(200).json({
      success: false,
      error: error.response?.data?.error?.message || 'Token-Info konnte nicht abgerufen werden',
    });
  }
}
