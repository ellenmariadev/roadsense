import { IncidentStatus } from '@prisma/client';

export const ALLOWED_STATUS_TRANSITIONS: Readonly<
  Record<IncidentStatus, readonly IncidentStatus[]>
> = {
  [IncidentStatus.REPORTED]: [
    IncidentStatus.UNDER_REVIEW,
    IncidentStatus.CONFIRMED,
    IncidentStatus.CANCELLED,
  ],
  [IncidentStatus.UNDER_REVIEW]: [IncidentStatus.CONFIRMED, IncidentStatus.CANCELLED],
  [IncidentStatus.CONFIRMED]: [IncidentStatus.IN_PROGRESS, IncidentStatus.CANCELLED],
  [IncidentStatus.IN_PROGRESS]: [IncidentStatus.RESOLVED, IncidentStatus.CANCELLED],
  [IncidentStatus.RESOLVED]: [],
  [IncidentStatus.CANCELLED]: [],
};

export function isTransitionAllowed(from: IncidentStatus, to: IncidentStatus): boolean {
  return ALLOWED_STATUS_TRANSITIONS[from].includes(to);
}

export function allowedTransitions(from: IncidentStatus): readonly IncidentStatus[] {
  return ALLOWED_STATUS_TRANSITIONS[from];
}
