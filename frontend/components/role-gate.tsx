'use client';

import type { ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import type { UserRole } from '@/lib/types';
import { AccessDenied, LoadingPanel } from './ui';

export function RoleGate({ roles, children }: { roles: UserRole[]; children: ReactNode }) {
  const { initialized, user } = useAuth();

  if (!initialized) {
    return <LoadingPanel label="Verificando permissões…" />;
  }
  if (!user || !roles.includes(user.role)) {
    return <AccessDenied />;
  }
  return <>{children}</>;
}
