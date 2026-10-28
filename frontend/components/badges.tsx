import { priorityLabel, statusLabel, triageStatusLabel, incidentTypeLabel } from '@/lib/format';
import type { IncidentStatus, IncidentType, Priority, TriageStatus } from '@/lib/types';

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={`badge badge-priority-${priority.toLowerCase()}`}>
      {priorityLabel(priority)}
    </span>
  );
}

export function StatusBadge({ status }: { status: IncidentStatus }) {
  return (
    <span className={`badge badge-status-${status.toLowerCase()}`}>{statusLabel(status)}</span>
  );
}

export function TriageStatusBadge({ status }: { status: TriageStatus }) {
  return (
    <span className={`badge badge-triage-${status.toLowerCase()}`}>
      {triageStatusLabel(status)}
    </span>
  );
}

export function IncidentTypeBadge({ type }: { type: IncidentType | null }) {
  if (!type) return <span className="muted">Não definido</span>;
  return <span className="badge badge-type">{incidentTypeLabel(type)}</span>;
}
