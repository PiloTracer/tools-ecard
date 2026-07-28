'use client';

/**
 * Authentication Context
 *
 * Provides authentication state and actions throughout the application.
 * Demo mode still requires a real OAuth session; demo data is scoped per user id.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { User, AuthContext as AuthContextType } from '@/shared/types/auth';
import { clearOAuthData } from '@/shared/lib/oauth-utils';
import { OAUTH_CONFIG } from '@/shared/lib/oauth-config';
import { isDemoMode, exitDemoMode } from '@/features/demo/isDemoMode';
import { bindDemoStoreToOAuthUser } from '@/features/demo/demoStore';
import { normalizeOAuthUser } from '@/shared/lib/normalizeOAuthUser';

function userFromAuthUserBody(data: unknown): User | null {
  return normalizeOAuthUser(data);
}

function clearSessionState(
  setUser: (u: User | null) => void,
  setIsAuthenticated: (v: boolean) => void
): void {
  bindDemoStoreToOAuthUser(null);
  setUser(null);
  setIsAuthenticated(false);
}

function applySessionUser(
  userData: User,
  setUser: (u: User | null) => void,
  setIsAuthenticated: (v: boolean) => void
): void {
  bindDemoStoreToOAuthUser(userData);
  setUser(userData);
  setIsAuthenticated(true);
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshToken = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/refresh-token', {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        const userResponse = await fetch('/api/auth/user', {
          credentials: 'include',
        });

        if (userResponse.ok) {
          const body = await userResponse.json();
          const userData = userFromAuthUserBody(body);
          if (userData) {
            applySessionUser(userData, setUser, setIsAuthenticated);
            return true;
          }
        }
      }

      return false;
    } catch (err) {
      console.error('Token refresh error:', err);
      return false;
    }
  }, []);

  const checkAuth = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/auth/user', {
        credentials: 'include',
      });

      if (response.ok) {
        const body = await response.json();
        const userData = userFromAuthUserBody(body);
        if (userData) {
          applySessionUser(userData, setUser, setIsAuthenticated);
        } else {
          clearSessionState(setUser, setIsAuthenticated);
        }
      } else if (response.status === 401) {
        const p = pathnameRef.current;
        if (p === '/login' || p === '/oauth/complete') {
          clearSessionState(setUser, setIsAuthenticated);
        } else {
          const refreshed = await refreshToken();
          if (!refreshed) {
            clearSessionState(setUser, setIsAuthenticated);
          }
        }
      } else {
        clearSessionState(setUser, setIsAuthenticated);
      }
    } catch (err) {
      console.error('Auth check error:', err);
      setError('Failed to check authentication status');
      clearSessionState(setUser, setIsAuthenticated);
    } finally {
      setIsLoading(false);
    }
  }, [refreshToken]);

  const login = useCallback(async () => {
    router.push('/login');
  }, [router]);

  const logout = useCallback(async () => {
    try {
      setIsLoading(true);
      const wasDemo = isDemoMode();

      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        clearSessionState(setUser, setIsAuthenticated);
        try {
          clearOAuthData(OAUTH_CONFIG.clientId);
          sessionStorage.removeItem('redirect_after_login');
        } catch {
          /* non-browser or storage blocked */
        }
        if (wasDemo) {
          exitDemoMode();
        }
        router.push('/login');
      } else {
        throw new Error('Logout failed');
      }
    } catch (err) {
      console.error('Logout error:', err);
      setError('Failed to logout');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (pathname === '/auth/continue') {
      setIsLoading(false);
      return;
    }
    checkAuth();
  }, [pathname, checkAuth]);

  const value: AuthContextType = {
    isAuthenticated,
    isLoading,
    user,
    error,
    login,
    logout,
    refreshToken,
    checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
