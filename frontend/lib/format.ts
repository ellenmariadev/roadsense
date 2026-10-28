import type {
  IncidentEventType,
  IncidentStatus,
  IncidentType,
  Priority,
  TriageStatus,
  UserRole,
} from './types';

export const INCIDENT_TYPE_LABELS: Record<IncidentType, string> = {
  ACCIDENT: 'Acidente',
  VEHICLE_BREAKDOWN: 'Pane de veículo',
  ROAD_OBSTRUCTION: 'Obstrução da via',
  FLOODING: 'Alagamento',
  INFRASTRUCTURE_DAMAGE: 'Dano à infraestrutura',
  OTHER: 'Outro',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
};

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  REPORTED: 'Reportado',
  UNDER_REVIEW: 'Em análise',
  CONFIRMED: 'Confirmado',
  IN_PROGRESS: 'Em atendimento',
  RESOLVED: 'Resolvido',
  CANCELLED: 'Cancelado',
};

export const TRIAGE_STATUS_LABELS: Record<TriageStatus, string> = {
  PENDING: 'Em execução',
  SUCCEEDED: 'Sugestão gerada',
  FAILED: 'Falhou',
  CONFIRMED: 'Confirmada',
  REJECTED: 'Rejeitada',
};

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Administrador',
  OPERATOR: 'Operador',
  VIEWER: 'Visualizador',
};

export const EVENT_LABELS: Record<IncidentEventType, string> = {
  INCIDENT_CREATED: 'Incidente criado',
  ATTRIBUTE_CHANGED: 'Atributo alterado',
  PRIORITY_CHANGED: 'Prioridade alterada',
  STATUS_TRANSITION: 'Mudança de status',
  TRIAGE_EXECUTED: 'Triagem executada',
  TRIAGE_FAILED: 'Triagem falhou',
  SUGGESTION_CONFIRMED: 'Sugestão confirmada',
  SUGGESTION_REJECTED: 'Sugestão rejeitada',
  RESOLVED: 'Incidente resolvido',
  CANCELLED: 'Incidente cancelado',
};

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

export function formatConfidence(value: number | null): string {
  if (value === null) return '—';
  return `${Math.round(value * 100)}%`;
}

export function formatLatency(value: number | null): string {
  if (value === null) return '—';
  return `${value} ms`;
}

export function formatTokens(run: {
  promptTokens: number | null;
  completionTokens: number | null;
}): string {
  if (run.promptTokens === null && run.completionTokens === null) return '—';
  return `${run.promptTokens ?? 0} entrada / ${run.completionTokens ?? 0} saída`;
}

export function incidentTypeLabel(value: IncidentType | null): string {
  return value ? INCIDENT_TYPE_LABELS[value] : 'Não definido';
}

export function priorityLabel(value: Priority): string {
  return PRIORITY_LABELS[value];
}

export function statusLabel(value: IncidentStatus): string {
  return INCIDENT_STATUS_LABELS[value];
}

export function triageStatusLabel(value: TriageStatus): string {
  return TRIAGE_STATUS_LABELS[value];
}

export function roleLabel(value: UserRole): string {
  return USER_ROLE_LABELS[value];
}

export function eventLabel(value: IncidentEventType): string {
  return EVENT_LABELS[value] ?? value;
}

export function incidentLocation(incident: {
  roadName: string | null;
  kilometerMarker: string | null;
  locationText: string | null;
}): string {
  const parts = [
    incident.roadName,
    incident.kilometerMarker ? `km ${incident.kilometerMarker}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return parts || incident.locationText || 'Local não informado';
}
