export type UserRole = 'ADMIN' | 'OPERATOR' | 'VIEWER';

export type IncidentType =
  | 'ACCIDENT'
  | 'VEHICLE_BREAKDOWN'
  | 'ROAD_OBSTRUCTION'
  | 'FLOODING'
  | 'INFRASTRUCTURE_DAMAGE'
  | 'OTHER';

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type IncidentStatus =
  'REPORTED' | 'UNDER_REVIEW' | 'CONFIRMED' | 'IN_PROGRESS' | 'RESOLVED' | 'CANCELLED';

export type IncidentEventType =
  | 'INCIDENT_CREATED'
  | 'ATTRIBUTE_CHANGED'
  | 'PRIORITY_CHANGED'
  | 'STATUS_TRANSITION'
  | 'TRIAGE_EXECUTED'
  | 'TRIAGE_FAILED'
  | 'SUGGESTION_CONFIRMED'
  | 'SUGGESTION_REJECTED'
  | 'RESOLVED'
  | 'CANCELLED';

export type TriageStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CONFIRMED' | 'REJECTED';

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface Incident {
  id: string;
  originalReport: string;
  incidentType: IncidentType | null;
  description: string | null;
  locationText: string | null;
  roadName: string | null;
  kilometerMarker: string | null;
  direction: string | null;
  priority: Priority;
  riskFactors: string[];
  status: IncidentStatus;
  reportedAt: string;
  resolvedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdById: string | null;
}

export interface IncidentEvent {
  id: string;
  type: IncidentEventType;
  metadata: unknown;
  createdAt: string;
  incidentId: string;
  actorId: string | null;
}

export interface AvailableTransitions {
  current: IncidentStatus;
  allowed: IncidentStatus[];
}

export interface TransitionIncidentInput {
  to: IncidentStatus;
  reason?: string;
}

export interface IncidentListResponse {
  items: Incident[];
  total: number;
  page: number;
  limit: number;
}

export interface ListIncidentsParams {
  page?: number;
  limit?: number;
  status?: IncidentStatus | '';
  priority?: Priority | '';
  incidentType?: IncidentType | '';
  roadName?: string;
  q?: string;
}

export interface CreateIncidentInput {
  originalReport: string;
  incidentType?: IncidentType;
  description?: string;
  locationText?: string;
  roadName?: string;
  kilometerMarker?: string;
  direction?: string;
  riskFactors?: string[];
}

export interface TriageRun {
  id: string;
  sourceText: string;
  status: TriageStatus;
  provider: string | null;
  model: string | null;
  latencyMs: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  errorMessage: string | null;
  suggestedIncidentType: IncidentType | null;
  suggestedDescription: string | null;
  suggestedLocationText: string | null;
  suggestedRoadName: string | null;
  suggestedKilometerMarker: string | null;
  suggestedDirection: string | null;
  riskFactors: string[];
  confidence: number | null;
  missingInformation: string[];
  idempotencyKey: string | null;
  requestedAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  incidentId: string | null;
}

export interface CreateTriageInput {
  sourceText: string;
  incidentId?: string;
  idempotencyKey?: string;
}

export interface RegisterUserInput {
  email: string;
  password: string;
  name?: string;
  role: UserRole;
}
