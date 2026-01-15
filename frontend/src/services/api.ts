import axios from 'axios';
import type { Interaction, SuggestionRequest, SuggestionResponse, APIResponse, InteractionLabels } from '../types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Connection Status type
export interface ConnectionStatus {
  connected: boolean;
  usingMockData: boolean;
  error?: string;
  errorType?: 'token_expired' | 'token_invalid' | 'network_error' | 'unknown';
}

// Instagram API
export const instagramApi = {
  getStatus: async (): Promise<ConnectionStatus> => {
    const response = await api.get<APIResponse<ConnectionStatus>>('/instagram/status');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch status');
    }
    return response.data.data!;
  },

  getInteractions: async (): Promise<Interaction[]> => {
    const response = await api.get<APIResponse<Interaction[]>>('/instagram/interactions');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch interactions');
    }
    return response.data.data || [];
  },

  getComments: async (): Promise<Interaction[]> => {
    const response = await api.get<APIResponse<Interaction[]>>('/instagram/comments');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch comments');
    }
    return response.data.data || [];
  },

  replyToComment: async (commentId: string, message: string): Promise<{ id: string }> => {
    const response = await api.post<APIResponse<{ id: string }>>(`/instagram/comments/${commentId}/reply`, {
      message,
    });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to reply to comment');
    }
    return response.data.data!;
  },

  getMentions: async (): Promise<Interaction[]> => {
    const response = await api.get<APIResponse<Interaction[]>>('/instagram/mentions');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch mentions');
    }
    return response.data.data || [];
  },

  getMessages: async (): Promise<Interaction[]> => {
    const response = await api.get<APIResponse<Interaction[]>>('/instagram/messages');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch messages');
    }
    return response.data.data || [];
  },

  sendMessage: async (recipientId: string, message: string): Promise<{ id: string }> => {
    const response = await api.post<APIResponse<{ id: string }>>('/instagram/messages', {
      recipientId,
      message,
    });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to send message');
    }
    return response.data.data!;
  },

  // Note: Liking comments is not supported by the Instagram Graph API
  // Users need to like comments directly on Instagram
};

// AI API
export const aiApi = {
  getSuggestions: async (request: SuggestionRequest): Promise<SuggestionResponse> => {
    const response = await api.post<APIResponse<SuggestionResponse>>('/ai/suggest', request);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to generate suggestions');
    }
    return response.data.data!;
  },

  checkHealth: async (): Promise<{ claude: { configured: boolean }; openai: { configured: boolean } }> => {
    const response = await api.get<APIResponse<{ claude: { configured: boolean }; openai: { configured: boolean } }>>('/ai/health');
    return response.data.data!;
  },

  categorize: async (interaction: Interaction): Promise<InteractionLabels> => {
    const response = await api.post<APIResponse<InteractionLabels>>('/ai/categorize', { interaction });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to categorize interaction');
    }
    return response.data.data!;
  },

  categorizeBatch: async (interactions: Interaction[]): Promise<Interaction[]> => {
    const response = await api.post<APIResponse<Interaction[]>>('/ai/categorize-batch', { interactions });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to categorize interactions');
    }
    return response.data.data!;
  },
};

// Settings API
export interface Settings {
  meta: {
    appId: string;
    appSecret: string;
    accessToken: string;
    instagramAccountId: string;
  };
  ai: {
    anthropicApiKey: string;
    openaiApiKey: string;
    openaiModel: string;
  };
}

export interface OpenAIModel {
  id: string;
  name: string;
}

export interface TokenInfo {
  isValid: boolean;
  expiresAt: string | null;
  scopes: string[];
  daysUntilExpiry: number | null;
}

export interface TokenRefreshResult {
  accessToken: string;
  expiresAt: string;
  expiresIn: number;
  daysUntilExpiry: number;
}

export const settingsApi = {
  get: async (full = false): Promise<Settings> => {
    const response = await api.get<APIResponse<Settings>>(`/settings${full ? '?full=true' : ''}`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch settings');
    }
    return response.data.data!;
  },

  save: async (settings: Partial<Settings>): Promise<{ updated: boolean; message?: string }> => {
    const response = await api.post<APIResponse<{ updated: boolean }>>('/settings', settings);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to save settings');
    }
    return { updated: response.data.data!.updated, message: response.data.message };
  },

  testInstagram: async (): Promise<{ connected: boolean; username?: string; error?: string }> => {
    const response = await api.post<APIResponse<{ connected: boolean; username?: string }>>('/settings/test/instagram');
    if (!response.data.success) {
      return { connected: false, error: response.data.error };
    }
    return response.data.data!;
  },

  testOpenAI: async (): Promise<{ connected: boolean; models?: number; error?: string }> => {
    const response = await api.post<APIResponse<{ connected: boolean; models?: number }>>('/settings/test/openai');
    if (!response.data.success) {
      return { connected: false, error: response.data.error };
    }
    return response.data.data!;
  },

  testAnthropic: async (): Promise<{ connected: boolean; model?: string; error?: string }> => {
    const response = await api.post<APIResponse<{ connected: boolean; model?: string }>>('/settings/test/anthropic');
    if (!response.data.success) {
      return { connected: false, error: response.data.error };
    }
    return response.data.data!;
  },

  getOpenAIModels: async (): Promise<OpenAIModel[]> => {
    const response = await api.get<APIResponse<OpenAIModel[]>>('/settings/openai-models');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch models');
    }
    return response.data.data!;
  },

  getTokenInfo: async (): Promise<TokenInfo> => {
    const response = await api.get<APIResponse<TokenInfo>>('/settings/token-info');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get token info');
    }
    return response.data.data!;
  },

  exchangeToken: async (shortLivedToken?: string): Promise<{ data: TokenRefreshResult; message: string }> => {
    const response = await api.post<APIResponse<TokenRefreshResult>>('/settings/exchange-token', {
      shortLivedToken,
    });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to exchange token');
    }
    return { data: response.data.data!, message: response.data.message || '' };
  },

  refreshToken: async (): Promise<{ data: TokenRefreshResult; message: string }> => {
    const response = await api.post<APIResponse<TokenRefreshResult>>('/settings/refresh-token');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to refresh token');
    }
    return { data: response.data.data!, message: response.data.message || '' };
  },
};

export default api;
