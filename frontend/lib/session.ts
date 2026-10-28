import type { AuthResponse, User } from './types';

export const SESSION_KEY = 'roadsense.session';

export interface Session {
  accessToken: string;
  user: User;
}

function isSession(value: unknown): value is Session {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Session>;
  return (
    typeof candidate.accessToken === 'string' &&
    !!candidate.user &&
    typeof candidate.user === 'object' &&
    typeof candidate.user.id === 'string' &&
    typeof candidate.user.email === 'string' &&
    typeof candidate.user.role === 'string'
  );
}

export function readSession(): Session | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function saveAuthResponse(response: AuthResponse): void {
  saveSession({ accessToken: response.accessToken, user: response.user });
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(SESSION_KEY);
}

export function readAccessToken(): string | null {
  return readSession()?.accessToken ?? null;
}
