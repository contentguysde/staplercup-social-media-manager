import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAccessToken, getTokenFromHeader } from '../_lib/auth';
import axios from 'axios';

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

    const { interaction, context } = req.body;

    const openaiApiKey = process.env.OPENAI_API_KEY;
    const openaiModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    // If no API key, return mock suggestions
    if (!openaiApiKey || openaiApiKey === 'your_openai_api_key') {
      return res.status(200).json({
        success: true,
        data: {
          suggestions: [
            'Vielen Dank für deine Nachricht! Wir melden uns in Kürze bei dir.',
            'Das freut uns zu hören! Der nächste StaplerCup findet im Frühjahr 2025 statt.',
            'Danke für dein Interesse! Alle Infos findest du auf unserer Website.',
          ],
          provider: 'mock',
        },
      });
    }

    try {
      const systemPrompt = `Du bist ein freundlicher Social Media Manager für den StaplerCup, einem professionellen Gabelstapler-Wettbewerb in Deutschland.
Deine Aufgabe ist es, auf Kommentare und Nachrichten zu antworten.
Antworte immer auf Deutsch, freundlich und professionell.
Halte die Antworten kurz und prägnant (max. 2-3 Sätze).
${context || ''}`;

      const userPrompt = `Bitte generiere 3 verschiedene Antwortvorschläge für folgende Nachricht:

Typ: ${interaction.type}
Von: @${interaction.from?.username || 'Unbekannt'}
Nachricht: "${interaction.content}"

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
          suggestions: [
            'Vielen Dank für deine Nachricht!',
            'Danke für dein Feedback!',
            'Wir melden uns bei dir!',
          ],
          provider: 'mock',
          error: 'AI temporarily unavailable',
        },
      });
    }
  } catch (error) {
    console.error('AI suggest error:', error);
    return res.status(500).json({ error: 'Interner Serverfehler' });
  }
}
