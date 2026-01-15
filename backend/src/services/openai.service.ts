import OpenAI from 'openai';
import { config } from '../config/env.js';
import type { SuggestionRequest, Tone } from '../types/index.js';

// Mock suggestions for demo mode (slightly different from Claude to show variety)
const MOCK_SUGGESTIONS: Record<string, string[]> = {
  default: [
    'Freut uns, dass dir der StaplerCup gefällt! 🎉 Der nächste Event ist für Herbst 2025 geplant - alle Infos folgen hier!',
    'Danke fürs Dabeisein! 🙏 Die Termine für 2025 geben wir bald bekannt. Bleib dran!',
    'Super, dass du fragst! 🏆 StaplerCup 2025 kommt - wir informieren dich rechtzeitig über alle Details!',
  ],
  sponsor: [
    'Herzlichen Dank für euer Interesse! 🙌 Für Sponsoring-Kooperationen schreibt an sponsoring@staplercup.de - wir freuen uns auf euch!',
    'Wow, das klingt großartig! 🤝 Alle Infos zu Sponsoring-Möglichkeiten bekommt ihr unter sponsoring@staplercup.de.',
    'Klasse, dass ihr Teil des StaplerCups werden wollt! 💼 Meldet euch bei sponsoring@staplercup.de für ein Gespräch!',
  ],
  mention: [
    'Yeah, so muss das! 🔥 Wir sind gespannt auf deine Performance beim nächsten StaplerCup!',
    'Training zahlt sich aus! 💪 Wir sehen uns beim StaplerCup 2025 - gib alles! 🏆',
    'Die Einstellung gefällt uns! 🙌 Zeig beim nächsten StaplerCup, was du drauf hast!',
  ],
};

class OpenAIService {
  private client: OpenAI | null = null;
  private useMockData: boolean;

  constructor() {
    this.useMockData = !config.ai.openaiApiKey || config.ai.openaiApiKey === 'your_openai_api_key';
    if (this.useMockData) {
      console.log('🤖 OpenAI: Using mock suggestions (no API key configured)');
    }
  }

  private getClient(): OpenAI {
    if (!this.client) {
      if (!config.ai.openaiApiKey) {
        throw new Error('OPENAI_API_KEY is not configured');
      }
      this.client = new OpenAI({
        apiKey: config.ai.openaiApiKey,
      });
    }
    return this.client;
  }

  private getToneInstructions(tone: Tone): string {
    switch (tone) {
      case 'professional':
        return 'Antworte professionell und sachlich, aber dennoch freundlich. Verwende eine höfliche Anrede.';
      case 'friendly':
        return 'Antworte freundlich und warmherzig. Zeige echtes Interesse und Wertschätzung. Emojis sind erlaubt.';
      case 'casual':
        return 'Antworte locker und entspannt, wie in einem Gespräch unter Freunden. Emojis sind willkommen.';
      default:
        return 'Antworte freundlich und authentisch.';
    }
  }

  async generateSuggestions(request: SuggestionRequest): Promise<string[]> {
    // Return mock data if no API key configured
    if (this.useMockData) {
      await new Promise((resolve) => setTimeout(resolve, 800)); // Simulate API delay
      const message = request.context.originalMessage.toLowerCase();
      if (message.includes('sponsor')) {
        return MOCK_SUGGESTIONS.sponsor;
      }
      if (request.context.interactionType === 'mention') {
        return MOCK_SUGGESTIONS.mention;
      }
      return MOCK_SUGGESTIONS.default;
    }

    const client = this.getClient();
    const tone = request.tone || 'friendly';
    const toneInstructions = this.getToneInstructions(tone);

    const systemPrompt = `Du bist der Social Media Manager für StaplerCup, einen Wettbewerb für Gabelstaplerfahrer.
Du antwortest auf ${request.context.platform} ${request.context.interactionType === 'comment' ? 'Kommentare' : request.context.interactionType === 'dm' ? 'Direktnachrichten' : 'Erwähnungen'}.

${toneInstructions}

Wichtige Richtlinien:
- Antworte immer auf Deutsch, es sei denn, die ursprüngliche Nachricht ist in einer anderen Sprache
- Halte Antworten kurz und prägnant (max 2-3 Sätze für Kommentare)
- Beziehe dich auf den Kontext des Posts wenn relevant
- Sei authentisch und vermeide generische Floskeln
- Fördere Engagement und Community-Gefühl

Generiere genau 3 verschiedene Antwortvorschläge, die sich im Stil leicht unterscheiden.
Antworte NUR mit einem JSON-Array mit genau 3 Strings, ohne weitere Erklärung.`;

    let userMessage = `Originalnachricht: "${request.context.originalMessage}"`;

    if (request.context.postContext) {
      userMessage += `\n\nPost-Kontext: ${request.context.postContext}`;
    }

    if (request.context.conversationHistory?.length) {
      userMessage += '\n\nBisheriger Gesprächsverlauf:';
      for (const msg of request.context.conversationHistory) {
        userMessage += `\n${msg.role === 'user' ? 'Nutzer' : 'Wir'}: ${msg.content}`;
      }
    }

    const response = await client.chat.completions.create({
      model: config.ai.openaiModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 1024,
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Parse JSON array from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('Could not parse suggestions from response');
    }

    const suggestions = JSON.parse(jsonMatch[0]) as string[];
    return suggestions.slice(0, 3);
  }
}

export const openaiService = new OpenAIService();
