import { useState, useCallback, useEffect } from 'react';
import { aiApi } from '../services/api';
import type { AIProvider, Tone, SuggestionRequest, Interaction } from '../types';

interface UseAIOptions {
  defaultProvider?: AIProvider;
  defaultTone?: Tone;
}

export function useAI(options: UseAIOptions = {}) {
  const { defaultProvider = 'openai', defaultTone = 'friendly' } = options;

  const [provider, setProvider] = useState<AIProvider>(defaultProvider);
  const [tone, setTone] = useState<Tone>(defaultTone);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableProviders, setAvailableProviders] = useState<{
    claude: boolean;
    openai: boolean;
  }>({ claude: false, openai: false });

  useEffect(() => {
    aiApi.checkHealth()
      .then((health) => {
        setAvailableProviders({
          claude: health.claude.configured,
          openai: health.openai.configured,
        });
      })
      .catch(console.error);
  }, []);

  const generateSuggestions = useCallback(
    async (interaction: Interaction) => {
      try {
        setLoading(true);
        setError(null);
        setSuggestions([]);

        const request: SuggestionRequest = {
          context: {
            platform: interaction.platform,
            interactionType: interaction.type,
            originalMessage: interaction.content,
            postContext: interaction.context?.mediaCaption,
            conversationHistory: interaction.replies?.map((r) => ({
              role: r.isOwn ? 'assistant' as const : 'user' as const,
              content: r.content,
            })),
          },
          provider,
          tone,
        };

        const response = await aiApi.getSuggestions(request);
        setSuggestions(response.suggestions);
        return response.suggestions;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to generate suggestions';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [provider, tone]
  );

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
    setError(null);
  }, []);

  return {
    provider,
    setProvider,
    tone,
    setTone,
    suggestions,
    loading,
    error,
    generateSuggestions,
    clearSuggestions,
    availableProviders,
  };
}
