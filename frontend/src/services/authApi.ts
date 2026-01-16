import axios from 'axios';

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
  (config) => {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export type Role = 'admin' | 'manager' | 'viewer';

export interface UserPublic {
  id: number;
  email: string;
  name: string;
  role: Role;
  email_verified: number;
  created_at: string;
  updated_at: string;
}

export interface LoginResponse {
  user: UserPublic;
  accessToken: string;
}

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export const authApi = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>('/auth/login', { email, password });
    localStorage.setItem(ACCESS_TOKEN_KEY, response.data.accessToken);
    return response.data;
  },

  logout: async (): Promise<void> => {
    try {
      await api.post('/auth/logout');
    } finally {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
    }
  },

  refresh: async (): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>('/auth/refresh');
    localStorage.setItem(ACCESS_TOKEN_KEY, response.data.accessToken);
    return response.data;
  },

  getMe: async (): Promise<UserPublic> => {
    const response = await api.get<{ user: UserPublic }>('/auth/me');
    return response.data.user;
  },

  // Admin: Register new user directly (no email verification)
  register: async (email: string, password: string, name: string, role: Role = 'viewer'): Promise<UserPublic> => {
    const response = await api.post<{ user: UserPublic }>('/auth/register', { email, password, name, role });
    return response.data.user;
  },

  // Public: Self-registration with email verification
  registerPublic: async (email: string, password: string, name: string): Promise<{ message: string }> => {
    const response = await api.post<{ message: string }>('/auth/register-public', { email, password, name });
    return response.data;
  },

  // Verify email token
  verifyEmail: async (token: string): Promise<{ message: string; user: UserPublic }> => {
    const response = await api.get<{ message: string; user: UserPublic }>(`/auth/verify-email?token=${token}`);
    return response.data;
  },

  // Check if registration is enabled
  isRegistrationEnabled: async (): Promise<boolean> => {
    const response = await api.get<{ enabled: boolean }>('/auth/registration-enabled');
    return response.data.enabled;
  },

  // Admin: Get all users
  getUsers: async (): Promise<UserPublic[]> => {
    const response = await api.get<{ users: UserPublic[] }>('/auth/users');
    return response.data.users;
  },

  // Admin: Delete user
  deleteUser: async (userId: number): Promise<void> => {
    await api.delete(`/auth/users/${userId}`);
  },

  // Admin: Update user role
  updateUserRole: async (userId: number, role: Role): Promise<UserPublic> => {
    const response = await api.put<{ user: UserPublic }>(`/auth/users/${userId}/role`, { role });
    return response.data.user;
  },

  // Admin: Update user name
  updateUserName: async (userId: number, name: string): Promise<UserPublic> => {
    const response = await api.put<{ user: UserPublic }>(`/auth/users/${userId}/name`, { name });
    return response.data.user;
  },

  getAccessToken: (): string | null => {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },

  setAccessToken: (token: string): void => {
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
  },

  clearAccessToken: (): void => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  },
};

export default authApi;
