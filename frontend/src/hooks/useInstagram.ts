import { useState, useEffect, useCallback } from 'react';
import { instagramApi, aiApi, interactionsApi } from '../services/api';
import type { ConnectionStatus } from '../services/api';
import type { Interaction, InteractionType, Platform, AssignmentInfo, AssignableUser } from '../types';

interface UseInstagramOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
  autoCategorize?: boolean;
}

export function useInstagram(options: UseInstagramOptions = {}) {
  const { autoRefresh = false, refreshInterval = 30000, autoCategorize = true } = options;

  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [archivedInteractions, setArchivedInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [categorizing, setCategorizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [archivedIds, setArchivedIds] = useState<Set<string>>(new Set());
  const [myAssignedIds, setMyAssignedIds] = useState<Set<string>>(new Set());
  const [allAssignments, setAllAssignments] = useState<AssignmentInfo[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);

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

  const fetchMetadata = useCallback(async () => {
    try {
      const [archived, read, myAssigned, assignments, users] = await Promise.all([
        interactionsApi.getArchivedIds(),
        interactionsApi.getReadIds(),
        interactionsApi.getMyAssigned(),
        interactionsApi.getAllAssignments(),
        interactionsApi.getUsers(),
      ]);
      setArchivedIds(new Set(archived));
      setReadIds(new Set(read));
      setMyAssignedIds(new Set(myAssigned));
      setAllAssignments(assignments);
      setAssignableUsers(users);
      return {
        archived: new Set(archived),
        read: new Set(read),
        myAssigned: new Set(myAssigned),
        assignments,
      };
    } catch (err) {
      console.error('Failed to fetch interaction metadata:', err);
      return {
        archived: new Set<string>(),
        read: new Set<string>(),
        myAssigned: new Set<string>(),
        assignments: [],
      };
    }
  }, []);

  const fetchInteractions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch interactions and metadata in parallel
      const [data, metadata] = await Promise.all([
        instagramApi.getInteractions(),
        fetchMetadata(),
      ]);

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

      // Apply read status from metadata and filter by archive status
      let processedData = data.map((interaction) => ({
        ...interaction,
        status: metadata.read.has(interaction.id) ? 'read' as const : interaction.status,
      }));

      // Auto-categorize if enabled
      if (autoCategorize) {
        processedData = await categorizeInteractions(processedData);
      }

      // Separate archived and active interactions
      const active = processedData.filter((i) => !metadata.archived.has(i.id));
      const archived = processedData.filter((i) => metadata.archived.has(i.id));

      setInteractions(active);
      setArchivedInteractions(archived);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch interactions');
    } finally {
      setLoading(false);
    }
  }, [autoCategorize, categorizeInteractions, fetchMetadata]);

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

  const markAsRead = useCallback(async (interactionId: string) => {
    try {
      await interactionsApi.markAsRead(interactionId);
      setReadIds((prev) => new Set([...prev, interactionId]));
      // Update interaction status locally
      setInteractions((prev) =>
        prev.map((i) => (i.id === interactionId ? { ...i, status: 'read' as const } : i))
      );
      setArchivedInteractions((prev) =>
        prev.map((i) => (i.id === interactionId ? { ...i, status: 'read' as const } : i))
      );
    } catch (err) {
      console.error('Failed to mark as read:', err);
      throw err;
    }
  }, []);

  const markAsUnread = useCallback(async (interactionId: string) => {
    try {
      await interactionsApi.markAsUnread(interactionId);
      setReadIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(interactionId);
        return newSet;
      });
      // Update interaction status locally
      setInteractions((prev) =>
        prev.map((i) => (i.id === interactionId ? { ...i, status: 'unread' as const } : i))
      );
      setArchivedInteractions((prev) =>
        prev.map((i) => (i.id === interactionId ? { ...i, status: 'unread' as const } : i))
      );
    } catch (err) {
      console.error('Failed to mark as unread:', err);
      throw err;
    }
  }, []);

  const archiveInteraction = useCallback(async (interactionId: string) => {
    try {
      await interactionsApi.archive(interactionId);
      setArchivedIds((prev) => new Set([...prev, interactionId]));
      // Move interaction from active to archived
      const interaction = interactions.find((i) => i.id === interactionId);
      if (interaction) {
        setInteractions((prev) => prev.filter((i) => i.id !== interactionId));
        setArchivedInteractions((prev) => [...prev, interaction]);
      }
    } catch (err) {
      console.error('Failed to archive:', err);
      throw err;
    }
  }, [interactions]);

  const unarchiveInteraction = useCallback(async (interactionId: string) => {
    try {
      await interactionsApi.unarchive(interactionId);
      setArchivedIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(interactionId);
        return newSet;
      });
      // Move interaction from archived to active
      const interaction = archivedInteractions.find((i) => i.id === interactionId);
      if (interaction) {
        setArchivedInteractions((prev) => prev.filter((i) => i.id !== interactionId));
        setInteractions((prev) => [...prev, interaction]);
      }
    } catch (err) {
      console.error('Failed to unarchive:', err);
      throw err;
    }
  }, [archivedInteractions]);

  const assignInteraction = useCallback(async (interactionId: string, userId: number) => {
    try {
      await interactionsApi.assign(interactionId, userId);
      // Refresh assignments to get updated data
      const [myAssigned, assignments] = await Promise.all([
        interactionsApi.getMyAssigned(),
        interactionsApi.getAllAssignments(),
      ]);
      setMyAssignedIds(new Set(myAssigned));
      setAllAssignments(assignments);
    } catch (err) {
      console.error('Failed to assign:', err);
      throw err;
    }
  }, []);

  const unassignInteraction = useCallback(async (interactionId: string) => {
    try {
      await interactionsApi.unassign(interactionId);
      // Update local state
      setMyAssignedIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(interactionId);
        return newSet;
      });
      setAllAssignments((prev) => prev.filter((a) => a.interaction_id !== interactionId));
    } catch (err) {
      console.error('Failed to unassign:', err);
      throw err;
    }
  }, []);

  // Get interactions assigned to the current user
  const getMyAssignedInteractions = useCallback(() => {
    const allInteractions = [...interactions, ...archivedInteractions];
    return allInteractions.filter((i) => myAssignedIds.has(i.id));
  }, [interactions, archivedInteractions, myAssignedIds]);

  // Get assignment info for a specific interaction
  const getAssignmentForInteraction = useCallback((interactionId: string): AssignmentInfo | undefined => {
    return allAssignments.find((a) => a.interaction_id === interactionId);
  }, [allAssignments]);

  return {
    interactions,
    archivedInteractions,
    loading,
    categorizing,
    error,
    connectionStatus,
    readIds,
    archivedIds,
    myAssignedIds,
    allAssignments,
    assignableUsers,
    refresh: fetchInteractions,
    replyToComment,
    sendMessage,
    filterByType,
    filterByPlatform,
    markAsRead,
    markAsUnread,
    archiveInteraction,
    unarchiveInteraction,
    assignInteraction,
    unassignInteraction,
    getMyAssignedInteractions,
    getAssignmentForInteraction,
  };
}
