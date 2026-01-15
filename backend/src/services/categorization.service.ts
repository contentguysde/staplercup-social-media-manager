import OpenAI from 'openai';
import { config } from '../config/env.js';
import type {
  Interaction,
  InteractionLabels,
  Urgency,
  Language,
  Topic,
  Platform,
} from '../types/index.js';

// In-memory cache for labels (in production, use Redis or DB)
const labelsCache = new Map<string, InteractionLabels>();

class CategorizationService {
  private client: OpenAI | null = null;
  private useMockData: boolean;

  constructor() {
    this.useMockData =
      !config.ai.openaiApiKey || config.ai.openaiApiKey === 'your_openai_api_key';
    if (this.useMockData) {
      console.log('🏷️  Categorization: Using mock labels (no API key configured)');
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

  // Generate mock labels based on content analysis
  private generateMockLabels(interaction: Interaction): InteractionLabels {
    const content = interaction.content.toLowerCase();

    // Simple keyword-based mock categorization
    let urgency: Urgency = 'low';
    let topic: Topic = 'general';
    let language: Language = 'de';

    // Urgency detection
    if (
      content.includes('dringend') ||
      content.includes('urgent') ||
      content.includes('sofort') ||
      content.includes('hilfe')
    ) {
      urgency = 'high';
    } else if (
      content.includes('frage') ||
      content.includes('wann') ||
      content.includes('wie') ||
      content.includes('?')
    ) {
      urgency = 'medium';
    }

    // Topic detection
    if (
      content.includes('anmeld') ||
      content.includes('teilnehm') ||
      content.includes('mitmachen') ||
      content.includes('registrier')
    ) {
      topic = 'participation_request';
      urgency = 'medium';
    } else if (
      content.includes('sponsor') ||
      content.includes('partner') ||
      content.includes('kooperation') ||
      content.includes('werbung')
    ) {
      topic = 'sponsor_inquiry';
      urgency = 'high';
    } else if (
      content.includes('super') ||
      content.includes('toll') ||
      content.includes('geil') ||
      content.includes('mega') ||
      content.includes('❤') ||
      content.includes('🔥') ||
      content.includes('👍')
    ) {
      topic = 'praise';
    } else if (
      content.includes('schlecht') ||
      content.includes('enttäuscht') ||
      content.includes('problem') ||
      content.includes('beschwer')
    ) {
      topic = 'criticism';
      urgency = 'high';
    } else if (content.includes('?') || content.includes('frage')) {
      topic = 'question';
    } else if (
      content.includes('video') ||
      content.includes('foto') ||
      content.includes('bild') ||
      content.includes('interview')
    ) {
      topic = 'media_request';
    }

    // Language detection (simple)
    const germanWords = ['der', 'die', 'das', 'und', 'ist', 'ich', 'wir', 'ihr', 'bei', 'beim'];
    const englishWords = ['the', 'and', 'is', 'are', 'we', 'you', 'this', 'that', 'with'];

    const germanCount = germanWords.filter((w) => content.includes(` ${w} `)).length;
    const englishCount = englishWords.filter((w) => content.includes(` ${w} `)).length;

    if (englishCount > germanCount) {
      language = 'en';
    } else if (germanCount === 0 && englishCount === 0) {
      // Check for non-latin characters
      if (/[^\x00-\x7F]/.test(content) && !/[äöüß]/.test(content)) {
        language = 'other';
      }
    }

    return {
      urgency,
      language,
      channel: interaction.platform,
      topic,
      confidence: 0.7,
    };
  }

  async categorizeInteraction(interaction: Interaction): Promise<InteractionLabels> {
    // Check cache first
    const cached = labelsCache.get(interaction.id);
    if (cached) {
      return cached;
    }

    // Use mock data if no API key
    if (this.useMockData) {
      const labels = this.generateMockLabels(interaction);
      labelsCache.set(interaction.id, labels);
      return labels;
    }

    const client = this.getClient();

    const systemPrompt = `Du bist ein Kategorisierungs-Experte für Social Media Kommentare des StaplerCup (Gabelstapler-Wettbewerb).

Analysiere den folgenden Kommentar und den Post-Kontext und kategorisiere ihn nach:

1. **Dringlichkeit (urgency)**:
   - "high": Beschwerden, Kritik, Sponsoring-Anfragen, dringende Fragen
   - "medium": Allgemeine Fragen, Teilnahme-Anfragen
   - "low": Lob, allgemeine Kommentare, Emojis

2. **Sprache (language)**:
   - "de": Deutsch
   - "en": Englisch
   - "other": Andere Sprachen

3. **Thema (topic)**:
   - "participation_request": Anfragen zur Teilnahme, Anmeldung
   - "praise": Lob, positive Kommentare, Begeisterung
   - "criticism": Kritik, Beschwerden, negative Kommentare
   - "question": Allgemeine Fragen
   - "sponsor_inquiry": Sponsoring- oder Kooperationsanfragen
   - "media_request": Anfragen zu Videos, Fotos, Interviews
   - "general": Allgemeine Kommentare ohne klare Kategorie
   - "spam": Spam, Werbung, irrelevante Inhalte

Antworte NUR mit einem JSON-Objekt im folgenden Format:
{
  "urgency": "high" | "medium" | "low",
  "language": "de" | "en" | "other",
  "topic": "participation_request" | "praise" | "criticism" | "question" | "sponsor_inquiry" | "media_request" | "general" | "spam",
  "confidence": 0.0-1.0
}`;

    let userMessage = `Kommentar: "${interaction.content}"`;
    if (interaction.context?.mediaCaption) {
      userMessage += `\n\nPost-Kontext: "${interaction.context.mediaCaption}"`;
    }
    userMessage += `\n\nPlattform: ${interaction.platform}`;
    userMessage += `\nTyp: ${interaction.type}`;

    try {
      const response = await client.chat.completions.create({
        model: config.ai.openaiModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        max_tokens: 256,
        temperature: 0.3, // Lower temperature for more consistent categorization
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      // Parse JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not parse categorization from response');
      }

      const parsed = JSON.parse(jsonMatch[0]) as {
        urgency: Urgency;
        language: Language;
        topic: Topic;
        confidence: number;
      };

      const labels: InteractionLabels = {
        urgency: parsed.urgency,
        language: parsed.language,
        channel: interaction.platform,
        topic: parsed.topic,
        confidence: parsed.confidence,
      };

      // Cache the result
      labelsCache.set(interaction.id, labels);
      return labels;
    } catch (error) {
      console.error('Categorization error:', error);
      // Fallback to mock labels on error
      const labels = this.generateMockLabels(interaction);
      labelsCache.set(interaction.id, labels);
      return labels;
    }
  }

  async categorizeMultiple(interactions: Interaction[]): Promise<Interaction[]> {
    // Process in parallel with concurrency limit
    const batchSize = 5;
    const results: Interaction[] = [];

    for (let i = 0; i < interactions.length; i += batchSize) {
      const batch = interactions.slice(i, i + batchSize);
      const labeledBatch = await Promise.all(
        batch.map(async (interaction) => {
          const labels = await this.categorizeInteraction(interaction);
          return { ...interaction, labels };
        })
      );
      results.push(...labeledBatch);
    }

    return results;
  }

  // Get cached labels for an interaction
  getCachedLabels(interactionId: string): InteractionLabels | undefined {
    return labelsCache.get(interactionId);
  }

  // Clear cache (useful for testing or refresh)
  clearCache(): void {
    labelsCache.clear();
  }
}

export const categorizationService = new CategorizationService();
