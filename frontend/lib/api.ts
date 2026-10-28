import axios from 'axios';
import { clearSession, readAccessToken } from './session';
import type {
  AuthResponse,
  AvailableTransitions,
  CreateIncidentInput,
  CreateTriageInput,
  Incident,
  IncidentEvent,
  IncidentListResponse,
  ListIncidentsParams,
  RegisterUserInput,
  TransitionIncidentInput,
  TriageRun,
  User,
} from './types';

export const UNAUTHORIZED_EVENT = 'roadsense:unauthorized';

export const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = readAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      !error.config?.url?.endsWith('/auth/login')
    ) {
      clearSession();
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    return Promise.reject(error);
  },
);

export async function login(email: string, password: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/login', { email, password });
  return data;
}

export async function getMe(): Promise<User> {
  const { data } = await api.get<User>('/auth/me');
  return data;
}

export async function registerUser(input: RegisterUserInput): Promise<User> {
  const { data } = await api.post<User>('/auth/register', input);
  return data;
}

export async function listIncidents(params: ListIncidentsParams): Promise<IncidentListResponse> {
  const cleanParams = Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== '' && value !== undefined && value !== null,
    ),
  ) as ListIncidentsParams;
  const { data } = await api.get<IncidentListResponse>('/incidents', { params: cleanParams });
  return data;
}

export async function getIncident(id: string): Promise<Incident> {
  const { data } = await api.get<Incident>(`/incidents/${id}`);
  return data;
}

export async function getIncidentEvents(id: string): Promise<IncidentEvent[]> {
  const { data } = await api.get<IncidentEvent[]>(`/incidents/${id}/events`);
  return data;
}

export async function createIncident(input: CreateIncidentInput): Promise<Incident> {
  const { data } = await api.post<Incident>('/incidents', input);
  return data;
}

export async function getAvailableTransitions(id: string): Promise<AvailableTransitions> {
  const { data } = await api.get<AvailableTransitions>(`/incidents/${id}/available-transitions`);
  return data;
}

export async function transitionIncident(
  id: string,
  input: TransitionIncidentInput,
): Promise<Incident> {
  const { data } = await api.post<Incident>(`/incidents/${id}/transitions`, input);
  return data;
}

export async function runTriage(input: CreateTriageInput): Promise<TriageRun> {
  const { data } = await api.post<TriageRun>('/triage', input);
  return data;
}

export async function getTriageRuns(incidentId: string): Promise<TriageRun[]> {
  const { data } = await api.get<TriageRun[]>(`/incidents/${incidentId}/triage`);
  return data;
}

export async function getTriageRun(id: string): Promise<TriageRun> {
  const { data } = await api.get<TriageRun>(`/triage/${id}`);
  return data;
}

export async function confirmTriage(incidentId: string, triageId: string): Promise<Incident> {
  const { data } = await api.post<Incident>(`/incidents/${incidentId}/triage/${triageId}/confirm`);
  return data;
}

export async function rejectTriage(
  incidentId: string,
  triageId: string,
  reason?: string,
): Promise<TriageRun> {
  const { data } = await api.post<TriageRun>(
    `/incidents/${incidentId}/triage/${triageId}/reject`,
    reason ? { reason } : {},
  );
  return data;
}

interface ErrorBody {
  statusCode?: number;
  message?: string | string[];
  error?: string;
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return 'Não foi possível conectar à API. Verifique se o backend está em execução.';
    }
    if (error.response.status === 401) {
      return 'Credenciais inválidas ou sessão expirada.';
    }
    if (error.response.status === 403) {
      return 'Seu perfil não tem permissão para esta operação.';
    }
    const body = error.response.data as ErrorBody | undefined;
    if (Array.isArray(body?.message)) {
      return body.message.join(' ');
    }
    if (typeof body?.message === 'string' && body.message.length > 0) {
      return body.message;
    }
  }
  return fallback;
}
