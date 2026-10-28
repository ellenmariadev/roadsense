'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { roleLabel } from '@/lib/format';

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, initialized, isAdmin, isOperator, logout } = useAuth();

  return (
    <div className="app-frame">
      <header className="site-header">
        <div className="header-inner">
          <Link className="brand" href="/incidents" aria-label="RoadSense — início">
            <span className="brand-mark" aria-hidden="true">
              RS
            </span>
            <span className="brand-name">
              Road<span>Sense</span>
            </span>
          </Link>

          <nav className="main-nav" aria-label="Navegação principal">
            <Link
              className={pathname.startsWith('/incidents') ? 'nav-link active' : 'nav-link'}
              href="/incidents"
            >
              Incidentes
            </Link>
            {isOperator ? (
              <Link
                className={pathname === '/incidents/new' ? 'nav-link active' : 'nav-link'}
                href="/incidents/new"
              >
                Novo relato
              </Link>
            ) : null}
            {isAdmin ? (
              <Link
                className={pathname === '/register' ? 'nav-link active' : 'nav-link'}
                href="/register"
              >
                Usuários
              </Link>
            ) : null}
          </nav>

          <div className="account-area">
            {!initialized ? (
              <span className="muted">…</span>
            ) : user ? (
              <>
                <div className="account-chip">
                  <span className="account-avatar" aria-hidden="true">
                    {(user.name ?? user.email).slice(0, 1).toUpperCase()}
                  </span>
                  <span>
                    <strong>{user.name ?? user.email}</strong>
                    <small>{roleLabel(user.role)}</small>
                  </span>
                </div>
                <button className="button button-ghost button-small" type="button" onClick={logout}>
                  Sair
                </button>
              </>
            ) : (
              <Link className="button button-primary button-small" href="/login">
                Entrar
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="page-shell">{children}</main>

      <footer className="site-footer">
        <span>RoadSense · operação local</span>
        <span>Prioridade e confirmação são decididas pelo backend.</span>
      </footer>
    </div>
  );
}
