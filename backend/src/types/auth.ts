export type Role = 'admin' | 'manager' | 'viewer';

export interface User {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  role: Role;
  created_at: string;
  updated_at: string;
}

export interface UserPublic {
  id: number;
  email: string;
  name: string;
  role: Role;
  created_at: string;
  updated_at: string;
}

export interface RefreshToken {
  id: number;
  user_id: number;
  token: string;
  expires_at: string;
  created_at: string;
}

export interface TokenPayload {
  userId: number;
  email: string;
  role: Role;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  role?: Role;
}

export interface AuthResponse {
  user: UserPublic;
  accessToken: string;
}

export interface CreateUserParams {
  email: string;
  passwordHash: string;
  name: string;
  role: Role;
}

export interface CreateTokenParams {
  userId: number;
  token: string;
  expiresAt: string;
}
