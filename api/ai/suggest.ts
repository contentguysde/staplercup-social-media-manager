import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAccessToken, getTokenFromHeader } from '../_lib/auth';
import axios from 'axios';
import Anthropic from '@anthropic-ai/sdk';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle OPTIONS preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify authentication
    const token = getTokenFromHeader(req.headers.authorization as string);
    if (!token) {
      return res.status(401).json({ error: 'Nicht authentifiziert' });
    }

    try {
      verifyAccessToken(token);
    } catch {
      return res.status(401).json({ error: 'Ungültiger Token' });
    }

    // Support both old and new request formats
    const { interaction, context, provider = 'openai', tone = 'friendly', customPrompt } = req.body;

    // Build context from old or new format
    const contextData = context || {};
    const interactionData = interaction || {
      type: contextData.interactionType || 'comment',
      content: contextData.originalMessage || '',
      from: { username: 'Unbekannt' },
    };

    // If using Claude
    if (provider === 'claude') {
      return handleClaudeGeneration(res, interactionData, contextData, tone, customPrompt);
    }

    // Default to OpenAI
    return handleOpenAIGeneration(res, interactionData, contextData, tone, customPrompt);

  } catch (error) {
    console.error('AI suggest error:', error);
    return res.status(500).json({ error: 'Interner Serverfehler' });
  }
}

async function handleClaudeGeneration(
  res: VercelResponse,
  interaction: any,
  context: any,
  tone: string,
  customPrompt?: string
) {
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

  if (!anthropicApiKey) {
    // Fall back to mock suggestions
    return res.status(200).json({
      success: true,
      data: {
        suggestions: getMockSuggestions(),
        provider: 'mock',
      },
    });
  }

  try {
    const anthropic = new Anthropic({ apiKey: anthropicApiKey });

    const toneDescription = getToneDescription(tone);
    const postContext = context.postContext ? `\nPost-Kontext: "${context.postContext}"` : '';
    const customInstructions = customPrompt ? `\n\nZusätzliche Anweisungen vom Nutzer: ${customPrompt}` : '';

    const systemPrompt = `Du bist ein freundlicher Social Media Manager für den StaplerCup, einem professionellen Gabelstapler-Wettbewerb in Deutschland.
Deine Aufgabe ist es, auf Kommentare und Nachrichten zu antworten.
Antworte immer auf Deutsch.
${toneDescription}
Halte die Antworten kurz und prägnant (max. 2-3 Sätze).
Nutze passende Emojis wenn angemessen.${customInstructions}`;

    const userPrompt = `Bitte generiere 3 verschiedene Antwortvorschläge für folgende Nachricht:

Typ: ${interaction.type}
Von: @${interaction.from?.username || 'Unbekannt'}
Nachricht: "${interaction.content || context.originalMessage}"${postContext}

Gib nur die 3 Antwortvorschläge zurück, jeweils in einer neuen Zeile, ohne Nummerierung oder Aufzählungszeichen.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt },
      ],
    });

    const content = response.content[0].type === 'text' ? response.content[0].text : '';
    const suggestions = content
      .split('\n')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0 && !s.match(/^\d+[\.\)]/))
      .slice(0, 3);

    return res.status(200).json({
      success: true,
      data: {
        suggestions: suggestions.length > 0 ? suggestions : getMockSuggestions(),
        provider: 'claude',
        model: 'claude-sonnet-4-20250514',
      },
    });
  } catch (error: any) {
    console.error('Claude error:', error.message);
    return res.status(200).json({
      success: true,
      data: {
        suggestions: getMockSuggestions(),
        provider: 'mock',
        error: 'AI temporarily unavailable',
      },
    });
  }
}

async function handleOpenAIGeneration(
  res: VercelResponse,
  interaction: any,
  context: any,
  tone: string,
  customPrompt?: string
) {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const openaiModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  if (!openaiApiKey || openaiApiKey === 'your_openai_api_key') {
    return res.status(200).json({
      success: true,
      data: {
        suggestions: getMockSuggestions(),
        provider: 'mock',
      },
    });
  }

  try {
    const toneDescription = getToneDescription(tone);
    const postContext = context.postContext ? `\nPost-Kontext: "${context.postContext}"` : '';
    const customInstructions = customPrompt ? `\n\nZusätzliche Anweisungen vom Nutzer: ${customPrompt}` : '';

    const systemPrompt = `Du bist ein freundlicher Social Media Manager für den StaplerCup, einem professionellen Gabelstapler-Wettbewerb in Deutschland.
Deine Aufgabe ist es, auf Kommentare und Nachrichten zu antworten.
Antworte immer auf Deutsch.
${toneDescription}
Halte die Antworten kurz und prägnant (max. 2-3 Sätze).
Nutze passende Emojis wenn angemessen.${customInstructions}`;

    const userPrompt = `Bitte generiere 3 verschiedene Antwortvorschläge für folgende Nachricht:

Typ: ${interaction.type}
Von: @${interaction.from?.username || 'Unbekannt'}
Nachricht: "${interaction.content || context.originalMessage}"${postContext}

Gib nur die 3 Antwortvorschläge zurück, jeweils in einer neuen Zeile, ohne Nummerierung.`;

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

    const content = response.data.choices[0]?.message?.content || '';
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
      },
    });
  }
}

function getToneDescription(tone: string): string {
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
