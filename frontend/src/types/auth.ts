export type Role = 'admin' | 'manager' | 'viewer';

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
  created_at: string;
  updated_at: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
