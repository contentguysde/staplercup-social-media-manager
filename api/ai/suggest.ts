import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAccessToken, getTokenFromHeader } from '../_lib/auth';
import axios from 'axios';
// Note: Anthropic SDK removed - using OpenAI only for now

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle OPTIONS preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('AI suggest: Starting request processing');

    // Verify authentication
    const token = getTokenFromHeader(req.headers.authorization as string);
    if (!token) {
      console.log('AI suggest: No token found');
      return res.status(401).json({ error: 'Nicht authentifiziert' });
    }

    try {
      verifyAccessToken(token);
      console.log('AI suggest: Token verified');
    } catch (authError: any) {
      console.log('AI suggest: Token verification failed:', authError?.message);
      return res.status(401).json({ error: 'Ungültiger Token' });
    }

    // Support both old and new request formats
    const body = req.body || {};
    console.log('AI suggest: Request body keys:', Object.keys(body));

    const { interaction, context, provider = 'openai', tone = 'friendly', customPrompt } = body;

    console.log('AI suggest request:', {
      provider,
      tone,
      hasContext: !!context,
      hasInteraction: !!interaction,
      contextKeys: context ? Object.keys(context) : [],
      interactionKeys: interaction ? Object.keys(interaction) : []
    });

    // Build context from old or new format
    const contextData = context || {};
    const interactionData = interaction || {
      type: contextData.interactionType || 'comment',
      content: contextData.originalMessage || '',
      from: { username: 'Unbekannt' },
    };

    // If using Claude
    if (provider === 'claude') {
      console.log('AI suggest: Using Claude provider');
      return await handleClaudeGeneration(res, interactionData, contextData, tone, customPrompt);
    }

    // Default to OpenAI
    console.log('AI suggest: Using OpenAI provider');
    console.log('AI suggest: interactionData:', JSON.stringify(interactionData));
    console.log('AI suggest: contextData:', JSON.stringify(contextData));
    return await handleOpenAIGeneration(res, interactionData, contextData, tone, customPrompt);

  } catch (error: any) {
    console.error('AI suggest error:', error?.message || error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Interner Serverfehler'
    });
  }
}

async function handleClaudeGeneration(
  res: VercelResponse,
  _interaction: any,
  _context: any,
  _tone: string,
  _customPrompt?: string
) {
  // Claude/Anthropic SDK not installed - fall back to mock suggestions
  // To enable Claude, install @anthropic-ai/sdk and add implementation
  console.log('Claude provider requested but not configured - returning mock data');
  return res.status(200).json({
    success: true,
    data: {
      suggestions: getMockSuggestions(),
      provider: 'mock',
      error: 'Claude nicht konfiguriert - bitte OpenAI verwenden',
    },
  });
}

async function handleOpenAIGeneration(
  res: VercelResponse,
  interaction: any,
  context: any,
  tone: string,
  customPrompt?: string
) {
  console.log('OpenAI handler: Starting');
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const openaiModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  console.log('OpenAI handler: API key present:', !!openaiApiKey, 'Model:', openaiModel);

  if (!openaiApiKey || openaiApiKey === 'your_openai_api_key') {
    console.log('OpenAI handler: No valid API key, returning mock');
    return res.status(200).json({
      success: true,
      data: {
        suggestions: getMockSuggestions(),
        provider: 'mock',
        detectedLanguage: 'de',
        responseLanguage: 'de',
      },
    });
  }

  const originalMessage = interaction.content || context.originalMessage || '';

  try {
    // Step 1: Detect language of the original message
    console.log('OpenAI handler: Detecting language for message:', originalMessage.substring(0, 100));
    const detectResponse = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: openaiModel,
        messages: [
          {
            role: 'system',
            content: 'Detect the language of the given text. Reply with ONLY the 2-letter ISO 639-1 code. Examples: de, en, pt, es, fr, it. Do not include any other text, punctuation, or explanation.'
          },
          {
            role: 'user',
            content: 'Hallo, wie geht es dir?'
          },
          {
            role: 'assistant',
            content: 'de'
          },
          {
            role: 'user',
            content: 'Hello, how are you doing today?'
          },
          {
            role: 'assistant',
            content: 'en'
          },
          {
            role: 'user',
            content: originalMessage
          },
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

    const rawDetection = (detectResponse.data.choices[0]?.message?.content || 'de').trim().toLowerCase();
    console.log('OpenAI handler: Raw language detection response:', rawDetection);

    // Extract language code - handle cases where GPT returns more than just the code
    // Look for common ISO 639-1 codes in the response
    let detectedLanguage = 'de';
    const langMatch = rawDetection.match(/\b(de|en|pt|es|fr|it|nl|pl|ru|zh|ja|ko|ar|tr|sv|da|no|fi)\b/);
    if (langMatch) {
      detectedLanguage = langMatch[1];
    } else if (rawDetection.length === 2) {
      detectedLanguage = rawDetection;
    } else if (rawDetection.includes('english')) {
      detectedLanguage = 'en';
    } else if (rawDetection.includes('german') || rawDetection.includes('deutsch')) {
      detectedLanguage = 'de';
    }

    console.log('OpenAI handler: Detected language:', detectedLanguage);

    // Determine response language: DE for German/other, EN for English
    const responseLanguage = detectedLanguage === 'en' ? 'en' : 'de';
    console.log('OpenAI handler: Will generate suggestions in:', responseLanguage);
    const needsTranslation = detectedLanguage !== 'de' && detectedLanguage !== 'en';

    console.log('OpenAI handler: Response language:', responseLanguage, 'Needs translation:', needsTranslation);

    // Step 2: Generate suggestions in the appropriate language
    const toneDescription = getToneDescription(tone, responseLanguage);
    const postContext = context.postContext ? `\nPost context: "${context.postContext}"` : '';
    const customInstructions = customPrompt
      ? `\n\n${responseLanguage === 'en' ? 'Additional instructions from user' : 'Zusätzliche Anweisungen vom Nutzer'}: ${customPrompt}`
      : '';

    const systemPrompt = responseLanguage === 'en'
      ? `You are a friendly social media manager for StaplerCup, a professional forklift competition in Germany.
Your task is to respond to comments and messages.
Always respond in English.
${toneDescription}
Keep responses short and concise (max 2-3 sentences).
Use appropriate emojis when suitable.${customInstructions}`
      : `Du bist ein freundlicher Social Media Manager für den StaplerCup, einem professionellen Gabelstapler-Wettbewerb in Deutschland.
Deine Aufgabe ist es, auf Kommentare und Nachrichten zu antworten.
Antworte immer auf Deutsch.
${toneDescription}
Halte die Antworten kurz und prägnant (max. 2-3 Sätze).
Nutze passende Emojis wenn angemessen.${customInstructions}`;

    const userPrompt = responseLanguage === 'en'
      ? `Please generate 3 different reply suggestions for the following message:

Type: ${interaction.type}
From: @${interaction.from?.username || 'Unknown'}
Message: "${originalMessage}"${postContext}

Return only the 3 suggestions, each on a new line, without numbering.`
      : `Bitte generiere 3 verschiedene Antwortvorschläge für folgende Nachricht:

Typ: ${interaction.type}
Von: @${interaction.from?.username || 'Unbekannt'}
Nachricht: "${originalMessage}"${postContext}

Gib nur die 3 Antwortvorschläge zurück, jeweils in einer neuen Zeile, ohne Nummerierung.`;

    console.log('OpenAI handler: Making API request for suggestions');
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: openaiModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 500,
      },
      {
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('OpenAI handler: Got response from OpenAI');
    const content = response.data.choices[0]?.message?.content || '';
    console.log('OpenAI handler: Extracted content length:', content.length);
    const suggestions = content
      .split('\n')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0)
      .slice(0, 3);

    return res.status(200).json({
      success: true,
      data: {
        suggestions,
        provider: 'openai',
        model: openaiModel,
        detectedLanguage,
        responseLanguage,
        needsTranslation,
      },
    });
  } catch (error: any) {
    console.error('OpenAI error:', error.response?.data || error.message);
    return res.status(200).json({
      success: true,
      data: {
        suggestions: getMockSuggestions(),
        provider: 'mock',
        error: 'AI temporarily unavailable',
        detectedLanguage: 'de',
        responseLanguage: 'de',
      },
    });
  }
}

function getToneDescription(tone: string, language: string = 'de'): string {
  if (language === 'en') {
    switch (tone) {
      case 'professional':
        return 'Respond professionally and formally.';
      case 'casual':
        return 'Respond casually and colloquially.';
      case 'friendly':
      default:
        return 'Respond in a friendly and warm manner.';
    }
  }
  // German (default)
  switch (tone) {
    case 'professional':
      return 'Antworte professionell und formell.';
    case 'casual':
      return 'Antworte locker und umgangssprachlich.';
    case 'friendly':
    default:
      return 'Antworte freundlich und warmherzig.';
  }
}

function getMockSuggestions(): string[] {
  return [
    'Vielen Dank für deine Nachricht! Wir melden uns in Kürze bei dir. 🏗️',
    'Das freut uns zu hören! Der nächste StaplerCup findet im Frühjahr 2025 statt. 🎯',
    'Danke für dein Interesse! Alle Infos findest du auf unserer Website. 💪',
  ];
}
