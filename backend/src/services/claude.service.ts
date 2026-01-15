import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config/env.js';
import type { SuggestionRequest, Tone } from '../types/index.js';

// Mock suggestions for demo mode
const MOCK_SUGGESTIONS: Record<string, string[]> = {
  default: [
    'Danke für deine Nachricht! 🙌 Der nächste StaplerCup findet im Herbst 2025 statt. Folge uns für alle Updates!',
    'Hey, freut uns sehr! 😊 Die Termine für 2025 werden bald bekannt gegeben. Stay tuned!',
    'Vielen Dank für dein Interesse! Die Anmeldung für StaplerCup 2025 startet in Kürze. Wir halten dich auf dem Laufenden! 🏆',
  ],
  sponsor: [
    'Vielen Dank für euer Interesse an einer Sponsoring-Partnerschaft! 🤝 Schreibt uns gerne eine E-Mail an sponsoring@staplercup.de für alle Details.',
    'Das freut uns sehr! Für Sponsoring-Anfragen erreicht ihr unser Team unter sponsoring@staplercup.de. Wir melden uns schnellstmöglich! 💪',
    'Toll, dass ihr dabei sein wollt! 🏆 Unser Sponsoring-Team steht euch unter sponsoring@staplercup.de zur Verfügung.',
  ],
  mention: [
    'Viel Erfolg beim Training! 💪 Wir drücken die Daumen für den StaplerCup 2025! 🏆',
    'Das nenne ich Motivation! 🔥 Zeig uns dein Können beim nächsten StaplerCup!',
    'So sieht Siegermentalität aus! 💪 Wir freuen uns auf dich beim StaplerCup! 🏆',
  ],
};

class ClaudeService {
  private client: Anthropic | null = null;
  private useMockData: boolean;

  constructor() {
    this.useMockData = !config.ai.anthropicApiKey || config.ai.anthropicApiKey === 'your_anthropic_api_key';
    if (this.useMockData) {
      console.log('🤖 Claude: Using mock suggestions (no API key configured)');
    }
  }

  private getClient(): Anthropic {
    if (!this.client) {
      if (!config.ai.anthropicApiKey) {
        throw new Error('ANTHROPIC_API_KEY is not configured');
      }
      this.client = new Anthropic({
        apiKey: config.ai.anthropicApiKey,
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
Formatiere deine Antwort als JSON-Array mit genau 3 Strings.`;

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

    userMessage += '\n\nGeneriere 3 Antwortvorschläge als JSON-Array:';

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
    });

    const textContent = response.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    // Parse JSON array from response
    const jsonMatch = textContent.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('Could not parse suggestions from response');
    }

    const suggestions = JSON.parse(jsonMatch[0]) as string[];
    return suggestions.slice(0, 3);
  }
}

export const claudeService = new ClaudeService();
