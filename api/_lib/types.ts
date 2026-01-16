export type Role = 'admin' | 'manager' | 'viewer';

export interface TokenPayload {
  userId: number;
  email: string;
  role: Role;
}

export interface User {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  role: Role;
  email_verified: number;
  created_at: string;
  updated_at: string;
}

export interface UserPublic {
  id: number;
  email: string;
  name: string;
  role: Role;
  email_verified: number;
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

export interface VerificationToken {
  id: number;
  email: string;
  token: string;
  name: string;
  password_hash: string;
  expires_at: string;
  created_at: string;
}
