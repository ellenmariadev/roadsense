'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { UNAUTHORIZED_EVENT, getMe, login as loginRequest } from './api';
import { clearSession, readSession, saveAuthResponse, saveSession } from './session';
import type { User } from './types';

interface AuthContextValue {
  user: User | null;
  initialized: boolean;
  isAdmin: boolean;
  isOperator: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const session = readSession();
    if (!session) {
      setInitialized(true);
      return;
    }

    setUser(session.user);
    getMe()
      .then((currentUser) => {
        saveSession({ accessToken: session.accessToken, user: currentUser });
        setUser(currentUser);
      })
      .catch(() => {
        clearSession();
        setUser(null);
      })
      .finally(() => setInitialized(true));
  }, []);

  useEffect(() => {
    const onUnauthorized = () => {
      setUser(null);
      setInitialized(true);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'roadsense.session') {
        setUser(readSession()?.user ?? null);
      }
    };

    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await loginRequest(email, password);
    saveAuthResponse(response);
    setUser(response.user);
    return response.user;
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      initialized,
      isAdmin: user?.role === 'ADMIN',
      isOperator: user?.role === 'OPERATOR' || user?.role === 'ADMIN',
      login,
      logout,
    }),
    [initialized, login, logout, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
