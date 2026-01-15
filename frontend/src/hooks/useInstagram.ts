import { useState, useEffect, useCallback } from 'react';
import { instagramApi, aiApi } from '../services/api';
import type { ConnectionStatus } from '../services/api';
import type { Interaction, InteractionType, Platform } from '../types';

interface UseInstagramOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
  autoCategorize?: boolean;
}

export function useInstagram(options: UseInstagramOptions = {}) {
  const { autoRefresh = false, refreshInterval = 30000, autoCategorize = true } = options;

  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [categorizing, setCategorizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);

  const categorizeInteractions = useCallback(async (data: Interaction[]) => {
    // Only categorize interactions that don't have labels yet
    const uncategorized = data.filter((i) => !i.labels);
    if (uncategorized.length === 0) return data;

    try {
      setCategorizing(true);
      const categorized = await aiApi.categorizeBatch(uncategorized);

      // Merge categorized interactions with existing data
      const labelMap = new Map(categorized.map((i) => [i.id, i.labels]));
      return data.map((interaction) => ({
        ...interaction,
        labels: labelMap.get(interaction.id) || interaction.labels,
      }));
    } catch (err) {
      console.error('Failed to categorize interactions:', err);
      return data; // Return original data if categorization fails
    } finally {
      setCategorizing(false);
    }
  }, []);

  const fetchInteractions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch interactions
      let data = await instagramApi.getInteractions();

      // Fetch connection status to check for API errors
      try {
        const status = await instagramApi.getStatus();
        setConnectionStatus(status);

        // If there's an API error, show it as a warning
        if (status.error && status.usingMockData) {
          setError(status.error);
        }
      } catch (statusErr) {
        console.error('Failed to fetch connection status:', statusErr);
      }

      // Auto-categorize if enabled
      if (autoCategorize) {
        data = await categorizeInteractions(data);
      }

      setInteractions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch interactions');
    } finally {
      setLoading(false);
    }
  }, [autoCategorize, categorizeInteractions]);

  const replyToComment = useCallback(async (commentId: string, message: string) => {
    const result = await instagramApi.replyToComment(commentId, message);
    await fetchInteractions();
    return result;
  }, [fetchInteractions]);

  const sendMessage = useCallback(async (recipientId: string, message: string) => {
    const result = await instagramApi.sendMessage(recipientId, message);
    await fetchInteractions();
    return result;
  }, [fetchInteractions]);

  useEffect(() => {
    fetchInteractions();

    if (autoRefresh) {
      const interval = setInterval(fetchInteractions, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchInteractions, autoRefresh, refreshInterval]);

  const filterByType = useCallback((type: InteractionType) => {
    return interactions.filter((i) => i.type === type);
  }, [interactions]);

  const filterByPlatform = useCallback((platform: Platform) => {
    return interactions.filter((i) => i.platform === platform);
  }, [interactions]);

  return {
    interactions,
    loading,
    categorizing,
    error,
    connectionStatus,
    refresh: fetchInteractions,
    replyToComment,
    sendMessage,
    filterByType,
    filterByPlatform,
  };
}
