import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import { sql } from '@vercel/postgres';

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

// POST /api/translate/translate - Translate text using OpenAI
async function handleTranslate(req: VercelRequest, res: VercelResponse) {
  const { text, targetLanguage, sourceLanguage } = req.body;

  if (!text || !targetLanguage) {
    return res.status(400).json({ error: 'text und targetLanguage sind erforderlich' });
  }

  const openaiApiKey = process.env.OPENAI_API_KEY;
  const openaiModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  if (!openaiApiKey || openaiApiKey === 'your_openai_api_key') {
    return res.status(500).json({ error: 'OpenAI API Key nicht konfiguriert' });
  }

  try {
    const targetLangName = LANGUAGE_NAMES[targetLanguage] || targetLanguage;
    const sourceLangName = sourceLanguage ? (LANGUAGE_NAMES[sourceLanguage] || sourceLanguage) : null;

    const systemPrompt = `You are a professional translator. Your ONLY task is to translate text into ${targetLangName}.

IMPORTANT RULES:
1. ALWAYS translate the text - never return the original text unchanged
2. If the text appears to be in a non-Latin script (Arabic, Chinese, Japanese, Korean, Hebrew, etc.), translate it to ${targetLangName}
3. Preserve emojis, @mentions, and #hashtags as-is
4. If the text seems like gibberish or cannot be meaningfully translated, provide your best interpretation or write "[Übersetzung nicht möglich]"
5. Output ONLY the translated text - no explanations, no quotes

You must output text in ${targetLangName} (${targetLanguage === 'de' ? 'German' : targetLangName}).`;

    const userPrompt = sourceLangName
      ? `Translate this ${sourceLangName} text to ${targetLangName}:\n\n${text}`
      : `Translate to ${targetLangName}:\n\n${text}`;

    console.log('Translation request:', { targetLanguage, targetLangName, textLength: text.length, textPreview: text.substring(0, 50) });

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: openaiModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.5, // Slightly higher for more creative translations
        max_tokens: 1024,
      },
      {
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    let translatedText = response.data.choices[0]?.message?.content?.trim() || '';
    console.log('Translation response:', { translatedTextLength: translatedText.length, translatedTextPreview: translatedText.substring(0, 50) });

    // Check if translation actually happened - if output equals input or is empty, try alternative approach
    if (translatedText === text || translatedText.length === 0) {
      console.log('Translation returned same text or empty, trying alternative prompt');

      // Use a more conversational approach that might work better for informal/slang text
      const retryResponse = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: openaiModel,
          messages: [
            {
              role: 'system',
              content: `You are a translator specializing in social media content. Translate text to ${targetLangName}, including slang, informal language, and incomplete sentences. Always provide your best translation attempt, even if the meaning is unclear. Output ONLY the ${targetLangName} translation.`
            },
            {
              role: 'user',
              content: `Translate this social media comment to ${targetLangName}. If it's slang or informal, translate the meaning/intent:\n\n"${text}"`
            },
          ],
          temperature: 0.8,
          max_tokens: 1024,
        },
        {
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const retryText = retryResponse.data.choices[0]?.message?.content?.trim() || '';
      console.log('Retry translation response:', retryText.substring(0, 100));

      // Use retry result if it's different from input and not empty
      if (retryText && retryText !== text) {
        translatedText = retryText;
      } else {
        // Last resort: ask for interpretation
        console.log('Retry also returned same text, asking for interpretation');
        const interpretResponse = await axios.post(
          'https://api.openai.com/v1/chat/completions',
          {
            model: openaiModel,
            messages: [
              {
                role: 'system',
                content: `You help interpret and translate social media content to ${targetLangName}. Even if text seems like nonsense or is hard to translate, provide your best interpretation in ${targetLangName}.`
              },
              {
                role: 'user',
                content: `This is a social media comment. Interpret it and respond in ${targetLangName}. What might this person be trying to say?\n\nOriginal: "${text}"\n\nYour ${targetLangName} interpretation:`
              },
            ],
            temperature: 0.9,
            max_tokens: 1024,
          },
          {
            headers: {
              'Authorization': `Bearer ${openaiApiKey}`,
              'Content-Type': 'application/json',
            },
          }
        );

        translatedText = interpretResponse.data.choices[0]?.message?.content?.trim() || `[Konnte nicht übersetzt werden: "${text.substring(0, 30)}..."]`;
        console.log('Interpretation response:', translatedText.substring(0, 100));
      }
    }

    // Detect source language if not provided
    let detectedLanguage = sourceLanguage;
    if (!detectedLanguage) {
      const detectResult = await detectLanguage(text, openaiApiKey, openaiModel);
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
    console.error('Translation error:', error.response?.data || error.message);
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

  const openaiApiKey = process.env.OPENAI_API_KEY;
  const openaiModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  if (!openaiApiKey || openaiApiKey === 'your_openai_api_key') {
    return res.status(500).json({ error: 'OpenAI API Key nicht konfiguriert' });
  }

  try {
    const result = await detectLanguage(text, openaiApiKey, openaiModel);
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

// Helper function for language detection using OpenAI
async function detectLanguage(
  text: string,
  openaiApiKey: string,
  openaiModel: string
): Promise<{ language: string; languageName: string; confidence: number }> {
  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: openaiModel,
      messages: [
        {
          role: 'system',
          content: 'Detect the language of the given text. Reply with ONLY the 2-letter ISO 639-1 code. Examples: de, en, pt, es, fr, it. Do not include any other text, punctuation, or explanation.'
        },
        { role: 'user', content: 'Hallo, wie geht es dir?' },
        { role: 'assistant', content: 'de' },
        { role: 'user', content: 'Hello, how are you doing today?' },
        { role: 'assistant', content: 'en' },
        { role: 'user', content: 'Olá, como você está?' },
        { role: 'assistant', content: 'pt' },
        { role: 'user', content: text },
      ],
      temperature: 0,
      max_tokens: 5,
    },
    {
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const rawDetection = (response.data.choices[0]?.message?.content || 'unknown').trim().toLowerCase();

  // Extract language code
  let language = 'unknown';
  const langMatch = rawDetection.match(/\b(de|en|pt|es|fr|it|nl|pl|ru|zh|ja|ko|ar|tr|sv|da|no|fi|cs|hu|ro|el|he|th|vi|id|ms|hi|bn|uk)\b/);
  if (langMatch) {
    language = langMatch[1];
  } else if (rawDetection.length === 2) {
    language = rawDetection;
  }

  return {
    language,
    languageName: LANGUAGE_NAMES[language] || language || 'Unknown',
    confidence: language !== 'unknown' ? 0.9 : 0.1,
  };
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
