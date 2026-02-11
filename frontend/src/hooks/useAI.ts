import { useState, useCallback, useEffect } from 'react';
import { aiApi } from '../services/api';
import type { AIProvider, Tone, SuggestionRequest, Interaction } from '../types';

interface UseAIOptions {
  defaultProvider?: AIProvider;
  defaultTone?: Tone;
}

interface LanguageInfo {
  detectedLanguage: string;
  responseLanguage: string;
  needsTranslation: boolean;
}

export function useAI(options: UseAIOptions = {}) {
  const { defaultProvider = 'openai', defaultTone = 'friendly' } = options;

  const [provider, setProvider] = useState<AIProvider>(defaultProvider);
  const [tone, setTone] = useState<Tone>(defaultTone);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [languageInfo, setLanguageInfo] = useState<LanguageInfo | null>(null);
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
    async (interaction: Interaction, customPrompt?: string) => {
      try {
        setLoading(true);
        setError(null);
        setSuggestions([]);
        setLanguageInfo(null);

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
          customPrompt,
        };

        const response = await aiApi.getSuggestions(request);
        setSuggestions(response.suggestions);

        // Store language info from response
        if (response.detectedLanguage) {
          setLanguageInfo({
            detectedLanguage: response.detectedLanguage,
            responseLanguage: response.responseLanguage || 'de',
            needsTranslation: response.needsTranslation || false,
          });
        }

        return response;
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
    setLanguageInfo(null);
    setError(null);
  }, []);

  return {
    provider,
    setProvider,
    tone,
    setTone,
    suggestions,
    languageInfo,
    loading,
    error,
    generateSuggestions,
    clearSuggestions,
    availableProviders,
  };
}
