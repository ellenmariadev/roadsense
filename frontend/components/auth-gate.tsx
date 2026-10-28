'use client';

import type { ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { LoadingPanel, SignInRequired } from './ui';

export function AuthGate({ children }: { children: ReactNode }) {
  const { initialized, user } = useAuth();

  if (!initialized) {
    return <LoadingPanel label="Verificando sessão…" />;
  }
  if (!user) {
    return <SignInRequired />;
  }
  return <>{children}</>;
}
