import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';
import { sql } from '@vercel/postgres';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// ISO 639-1 language codes mapping
const LANGUAGE_NAMES: Record<string, string> = {
  de: 'German',
  en: 'English',
  pt: 'Portuguese',
  es: 'Spanish',
  fr: 'French',
  it: 'Italian',
  nl: 'Dutch',
  pl: 'Polish',
  ru: 'Russian',
  ja: 'Japanese',
  ko: 'Korean',
  zh: 'Chinese',
  ar: 'Arabic',
  tr: 'Turkish',
  sv: 'Swedish',
  da: 'Danish',
  no: 'Norwegian',
  fi: 'Finnish',
  cs: 'Czech',
  hu: 'Hungarian',
  ro: 'Romanian',
  el: 'Greek',
  he: 'Hebrew',
  th: 'Thai',
  vi: 'Vietnamese',
  id: 'Indonesian',
  ms: 'Malay',
  hi: 'Hindi',
  bn: 'Bengali',
  uk: 'Ukrainian',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle OPTIONS preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const action = (req.query.action as string) || '';

  try {
    // POST /api/translate/translate - Translate text
    if (req.method === 'POST' && action === 'translate') {
      return handleTranslate(req, res);
    }

    // POST /api/translate/detect - Detect language
    if (req.method === 'POST' && action === 'detect') {
      return handleDetect(req, res);
    }

    // GET /api/translate/cached/:id - Get cached translation
    if (req.method === 'GET' && action === 'cached') {
      return handleGetCached(req, res);
    }

    // POST /api/translate/store - Store translation in DB
    if (req.method === 'POST' && action === 'store') {
      return handleStore(req, res);
    }

    return res.status(404).json({ error: 'Endpoint nicht gefunden' });
  } catch (error) {
    console.error('Translation API error:', error);
    return res.status(500).json({ error: 'Interner Serverfehler' });
  }
}

// POST /api/translate/translate - Translate text using Claude
async function handleTranslate(req: VercelRequest, res: VercelResponse) {
  const { text, targetLanguage, sourceLanguage } = req.body;

  if (!text || !targetLanguage) {
    return res.status(400).json({ error: 'text und targetLanguage sind erforderlich' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY nicht konfiguriert' });
  }

  try {
    const targetLangName = LANGUAGE_NAMES[targetLanguage] || targetLanguage;
    const sourceLangName = sourceLanguage ? (LANGUAGE_NAMES[sourceLanguage] || sourceLanguage) : null;

    const systemPrompt = `You are a professional translator. Translate the given text accurately while preserving:
- The original tone and style
- Emojis and special characters
- Mentions (@username) and hashtags (#tag)
- Line breaks and formatting

Only output the translated text, nothing else. No explanations, no quotes around the text.`;

    const userPrompt = sourceLangName
      ? `Translate the following text from ${sourceLangName} to ${targetLangName}:\n\n${text}`
      : `Translate the following text to ${targetLangName}:\n\n${text}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      system: systemPrompt,
    });

    const translatedText = response.content[0].type === 'text'
      ? response.content[0].text.trim()
      : '';

    // Detect source language if not provided
    let detectedLanguage = sourceLanguage;
    if (!detectedLanguage) {
      const detectResult = await detectLanguage(text);
      detectedLanguage = detectResult.language;
    }

    return res.status(200).json({
      success: true,
      data: {
        translatedText,
        sourceLanguage: detectedLanguage,
        targetLanguage,
      },
    });
  } catch (error: any) {
    console.error('Translation error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Übersetzung fehlgeschlagen',
    });
  }
}

// POST /api/translate/detect - Detect language of text
async function handleDetect(req: VercelRequest, res: VercelResponse) {
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'text ist erforderlich' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY nicht konfiguriert' });
  }

  try {
    const result = await detectLanguage(text);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Language detection error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Spracherkennung fehlgeschlagen',
    });
  }
}

// Helper function for language detection
async function detectLanguage(text: string): Promise<{ language: string; languageName: string; confidence: number }> {
  const systemPrompt = `You are a language detection expert. Analyze the given text and determine its language.
Respond ONLY with a JSON object in this exact format (no markdown, no code blocks):
{"language": "xx", "confidence": 0.95}

Where "language" is the ISO 639-1 two-letter code (e.g., "de" for German, "en" for English, "pt" for Portuguese).
And "confidence" is a number between 0 and 1 indicating how confident you are.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 100,
    messages: [
      {
        role: 'user',
        content: `Detect the language of this text:\n\n${text}`,
      },
    ],
    system: systemPrompt,
  });

  const responseText = response.content[0].type === 'text' ? response.content[0].text.trim() : '{}';

  try {
    const parsed = JSON.parse(responseText);
    return {
      language: parsed.language || 'unknown',
      languageName: LANGUAGE_NAMES[parsed.language] || parsed.language || 'Unknown',
      confidence: parsed.confidence || 0.5,
    };
  } catch {
    // Fallback if JSON parsing fails
    return {
      language: 'unknown',
      languageName: 'Unknown',
      confidence: 0,
    };
  }
}

// GET /api/translate/cached - Get cached translation from DB
async function handleGetCached(req: VercelRequest, res: VercelResponse) {
  const id = req.query.id as string;

  if (!id) {
    return res.status(400).json({ error: 'id ist erforderlich' });
  }

  try {
    const result = await sql`
      SELECT * FROM translations WHERE id = ${parseInt(id, 10)}
    `;

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Übersetzung nicht gefunden',
      });
    }

    const translation = result.rows[0];
    return res.status(200).json({
      success: true,
      data: {
        id: translation.id,
        originalText: translation.original_text,
        translatedText: translation.translated_text,
        sourceLanguage: translation.source_language,
        targetLanguage: translation.target_language,
        contextType: translation.context_type,
        contextId: translation.context_id,
        platform: translation.platform,
        createdAt: translation.created_at,
      },
    });
  } catch (error: any) {
    // Table might not exist yet
    if (error.message?.includes('does not exist')) {
      return res.status(404).json({
        success: false,
        error: 'Übersetzung nicht gefunden',
      });
    }
    console.error('Get cached translation error:', error);
    return res.status(500).json({
      success: false,
      error: 'Fehler beim Abrufen der Übersetzung',
    });
  }
}

// POST /api/translate/store - Store translation in DB
async function handleStore(req: VercelRequest, res: VercelResponse) {
  const { originalText, translatedText, sourceLanguage, targetLanguage, contextType, contextId, platform } = req.body;

  if (!originalText || !translatedText || !sourceLanguage || !targetLanguage || !contextType) {
    return res.status(400).json({
      error: 'originalText, translatedText, sourceLanguage, targetLanguage und contextType sind erforderlich'
    });
  }

  try {
    // Create table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS translations (
        id SERIAL PRIMARY KEY,
        original_text TEXT NOT NULL,
        translated_text TEXT NOT NULL,
        source_language VARCHAR(10) NOT NULL,
        target_language VARCHAR(10) NOT NULL,
        context_type VARCHAR(50) NOT NULL,
        context_id VARCHAR(255),
        platform VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create index if it doesn't exist
    try {
      await sql`CREATE INDEX IF NOT EXISTS idx_translations_context ON translations(context_type, context_id)`;
    } catch {
      // Index might already exist
    }

    // Insert the translation
    const result = await sql`
      INSERT INTO translations (original_text, translated_text, source_language, target_language, context_type, context_id, platform)
      VALUES (${originalText}, ${translatedText}, ${sourceLanguage}, ${targetLanguage}, ${contextType}, ${contextId || null}, ${platform || null})
      RETURNING id
    `;

    return res.status(200).json({
      success: true,
      data: {
        translationId: result.rows[0].id,
      },
    });
  } catch (error: any) {
    console.error('Store translation error:', error);
    return res.status(500).json({
      success: false,
      error: 'Fehler beim Speichern der Übersetzung',
    });
  }
}
