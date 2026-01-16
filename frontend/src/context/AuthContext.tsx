import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { User, LoginCredentials, AuthState } from '../types/auth';

// In production (Vercel), API is at same origin. In development, use localhost:3001
const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<string | null>;
  getAccessToken: () => string | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

const ACCESS_TOKEN_KEY = 'accessToken';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(() => {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  });

  const getAccessToken = useCallback(() => accessToken, [accessToken]);

  const saveAccessToken = useCallback((token: string | null) => {
    setAccessToken(token);
    if (token) {
      localStorage.setItem(ACCESS_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
    }
  }, []);

  const refreshToken = useCallback(async (): Promise<string | null> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Refresh failed');
      }

      const data = await response.json();
      saveAccessToken(data.accessToken);
      setUser(data.user);
      return data.accessToken;
    } catch {
      saveAccessToken(null);
      setUser(null);
      return null;
    }
  }, [saveAccessToken]);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Anmeldung fehlgeschlagen');
    }

    const data = await response.json();
    saveAccessToken(data.accessToken);
    setUser(data.user);
  }, [saveAccessToken]);

  const logout = useCallback(async () => {
    try {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        credentials: 'include',
      });
    } catch {
      // Ignore errors during logout
    } finally {
      saveAccessToken(null);
      setUser(null);
    }
  }, [accessToken, saveAccessToken]);

  // Check authentication status on mount
  useEffect(() => {
    async function checkAuth() {
      if (!accessToken) {
        // Try to refresh if no access token
        const newToken = await refreshToken();
        if (!newToken) {
          setIsLoading(false);
          return;
        }
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        } else if (response.status === 401) {
          // Token expired, try refresh
          const newToken = await refreshToken();
          if (!newToken) {
            saveAccessToken(null);
          }
        } else {
          saveAccessToken(null);
        }
      } catch {
        // Try refresh on network error
        await refreshToken();
      } finally {
        setIsLoading(false);
      }
    }

    checkAuth();
  }, []); // Only run on mount

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    refreshToken,
    getAccessToken,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
