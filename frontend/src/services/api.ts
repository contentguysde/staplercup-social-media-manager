import axios from 'axios';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type { Interaction, SuggestionRequest, SuggestionResponse, APIResponse, InteractionLabels, InteractionMetadata, AssignmentInfo, AssignableUser } from '../types';

// In production (Vercel), API is at same origin. In development, use localhost:3001
const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');
const ACCESS_TOKEN_KEY = 'accessToken';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor - add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle token refresh
let isRefreshing = false;
let failedQueue: { resolve: (token: string) => void; reject: (error: Error) => void }[] = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // If error is 401 and we haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Queue the request while refresh is in progress
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(api(originalRequest));
            },
            reject: (err: Error) => {
              reject(err);
            },
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Refresh failed');
        }

        const data = await response.json();
        const newToken = data.accessToken;

        localStorage.setItem(ACCESS_TOKEN_KEY, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;

        processQueue(null, newToken);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as Error, null);
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        window.location.href = '/';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

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

// Interactions Metadata API
export const interactionsApi = {
  getMetadata: async (): Promise<InteractionMetadata[]> => {
    const response = await api.get<APIResponse<InteractionMetadata[]>>('/interactions/metadata');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch metadata');
    }
    return response.data.data || [];
  },

  getArchivedIds: async (): Promise<string[]> => {
    const response = await api.get<APIResponse<string[]>>('/interactions/archived');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch archived IDs');
    }
    return response.data.data || [];
  },

  getReadIds: async (): Promise<string[]> => {
    const response = await api.get<APIResponse<string[]>>('/interactions/read');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch read IDs');
    }
    return response.data.data || [];
  },

  markAsRead: async (interactionId: string): Promise<InteractionMetadata> => {
    const response = await api.post<APIResponse<InteractionMetadata>>('/interactions/mark-read', {
      interactionId,
    });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to mark as read');
    }
    return response.data.data!;
  },

  markAsUnread: async (interactionId: string): Promise<InteractionMetadata> => {
    const response = await api.post<APIResponse<InteractionMetadata>>('/interactions/mark-unread', {
      interactionId,
    });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to mark as unread');
    }
    return response.data.data!;
  },

  archive: async (interactionId: string): Promise<InteractionMetadata> => {
    const response = await api.post<APIResponse<InteractionMetadata>>('/interactions/archive', {
      interactionId,
    });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to archive');
    }
    return response.data.data!;
  },

  unarchive: async (interactionId: string): Promise<InteractionMetadata> => {
    const response = await api.post<APIResponse<InteractionMetadata>>('/interactions/unarchive', {
      interactionId,
    });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to unarchive');
    }
    return response.data.data!;
  },

  // Assignment operations
  assign: async (interactionId: string, userId: number): Promise<InteractionMetadata> => {
    const response = await api.post<APIResponse<InteractionMetadata>>('/interactions/assign', {
      interactionId,
      userId,
    });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to assign');
    }
    return response.data.data!;
  },

  unassign: async (interactionId: string): Promise<InteractionMetadata> => {
    const response = await api.post<APIResponse<InteractionMetadata>>('/interactions/unassign', {
      interactionId,
    });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to unassign');
    }
    return response.data.data!;
  },

  getMyAssigned: async (): Promise<string[]> => {
    const response = await api.get<APIResponse<string[]>>('/interactions/my-assigned');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch assigned IDs');
    }
    return response.data.data || [];
  },

  getAllAssignments: async (): Promise<AssignmentInfo[]> => {
    const response = await api.get<APIResponse<AssignmentInfo[]>>('/interactions/assignments');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch assignments');
    }
    return response.data.data || [];
  },

  getUsers: async (): Promise<AssignableUser[]> => {
    const response = await api.get<APIResponse<AssignableUser[]>>('/interactions/users');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch users');
    }
    return response.data.data || [];
  },
};

export default api;
