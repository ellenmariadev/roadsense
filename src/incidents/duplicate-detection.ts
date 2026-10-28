import { Incident, IncidentType } from '@prisma/client';

/**
 * Deterministic, transparent duplicate-candidate matching for road incidents.
 *
 * Signals are computed from structured incident attributes only (road name,
 * kilometer marker, incident type, normalized description and timestamps).
 * The score is a fixed weighted sum of signals, clamped to [0, 1]; a pair is a
 * *candidate* when `score >= threshold`. No geographic coordinates are used
 * (hence PostGIS is not required — see README).
 */

export const DEFAULT_DUPLICATE_THRESHOLD = 0.5;

const KM_MATCH_TOLERANCE = 0.5;
const KM_NEAR_TOLERANCE = 2;
const SAME_DAY_HOURS = 24;
const SAME_WEEK_HOURS = 24 * 7;

const STOPWORDS = new Set([
  'a',
  'o',
  'as',
  'os',
  'um',
  'uma',
  'uns',
  'umas',
  'de',
  'da',
  'do',
  'das',
  'dos',
  'em',
  'na',
  'no',
  'nas',
  'nos',
  'e',
  'com',
  'para',
  'por',
  'que',
  'foi',
  'há',
  'ha',
  'nao',
  'não',
  'pela',
  'pelo',
  'ao',
  'aos',
  'à',
  'no',
  'entre',
  'dois',
  'duas',
  'km',
]);

export type RoadSignal = 'match' | 'mismatch' | 'missing';
export type KilometerSignal = 'match' | 'near' | 'mismatch' | 'missing';
export type TypeSignal = 'match' | 'generic_match' | 'mismatch' | 'missing';
export type TimeSignal = 'same_day' | 'same_week' | 'older' | 'missing';

export interface DuplicateSignals {
  road: { value: RoadSignal; reason: string };
  kilometer: { value: KilometerSignal; reason: string };
  incidentType: { value: TypeSignal; reason: string };
  description: { value: number; reason: string };
  time: { value: TimeSignal; reason: string };
}

export interface DuplicateEvaluation {
  score: number;
  isCandidate: boolean;
  signals: DuplicateSignals;
}

export interface IncidentLike {
  roadName: string | null;
  kilometerMarker: string | null;
  incidentType: IncidentType | null;
  description: string | null;
  reportedAt: Date;
}

const ROAD_WEIGHTS: Record<RoadSignal, number> = {
  match: 0.35,
  mismatch: -0.4,
  missing: 0,
};

const KM_WEIGHTS: Record<KilometerSignal, number> = {
  match: 0.2,
  near: 0.1,
  mismatch: -0.2,
  missing: 0,
};

const TYPE_WEIGHTS: Record<TypeSignal, number> = {
  match: 0.2,
  generic_match: 0.05,
  mismatch: -0.15,
  missing: 0,
};

const TIME_WEIGHTS: Record<TimeSignal, number> = {
  same_day: 0.1,
  same_week: 0.05,
  older: 0,
  missing: 0,
};

const DESCRIPTION_WEIGHT = 0.15;

export function normalizeRoad(value: string | null): string | null {
  if (!value) return null;
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  return normalized.length > 0 ? normalized : null;
}

export function extractKilometer(value: string | null): number | null {
  if (!value) return null;
  const cleaned = value.toLowerCase().replace(/km/g, '').replace(/,/g, '.');
  const match = cleaned.match(/\d+(\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function tokenize(value: string | null): string[] {
  if (!value) return [];
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

export function jaccardSimilarity(a: string | null, b: string | null): number {
  const setA = new Set(tokenize(a));
  const setB = new Set(tokenize(b));
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection += 1;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function hoursBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60);
}

function roadSignal(a: IncidentLike, b: IncidentLike): { value: RoadSignal; reason: string } {
  const roadA = normalizeRoad(a.roadName);
  const roadB = normalizeRoad(b.roadName);

  if (!roadA && !roadB) {
    return { value: 'missing', reason: 'both incidents lack a road name' };
  }
  if (!roadA || !roadB) {
    return { value: 'missing', reason: 'road name missing on one side' };
  }
  if (roadA === roadB) {
    return { value: 'match', reason: `same normalized road "${roadA}"` };
  }
  return { value: 'mismatch', reason: `different roads "${roadA}" vs "${roadB}"` };
}

function kilometerSignal(
  a: IncidentLike,
  b: IncidentLike,
): { value: KilometerSignal; reason: string } {
  const kmA = extractKilometer(a.kilometerMarker);
  const kmB = extractKilometer(b.kilometerMarker);

  if (kmA === null && kmB === null) {
    return { value: 'missing', reason: 'both incidents lack a kilometer marker' };
  }
  if (kmA === null || kmB === null) {
    return { value: 'missing', reason: 'kilometer marker missing on one side' };
  }

  const diff = Math.abs(kmA - kmB);
  if (diff <= KM_MATCH_TOLERANCE) {
    return { value: 'match', reason: `same kilometer marker (${kmA} ≈ ${kmB})` };
  }
  if (diff <= KM_NEAR_TOLERANCE) {
    return { value: 'near', reason: `kilometer markers within ±${KM_NEAR_TOLERANCE} km` };
  }
  return { value: 'mismatch', reason: `kilometer markers differ (${kmA} vs ${kmB})` };
}

function typeSignal(a: IncidentLike, b: IncidentLike): { value: TypeSignal; reason: string } {
  if (!a.incidentType && !b.incidentType) {
    return { value: 'missing', reason: 'both incidents lack a confirmed type' };
  }
  if (!a.incidentType || !b.incidentType) {
    return { value: 'missing', reason: 'incident type missing on one side' };
  }
  if (a.incidentType === b.incidentType) {
    if (a.incidentType === IncidentType.OTHER) {
      return { value: 'generic_match', reason: 'both typed as generic OTHER' };
    }
    return { value: 'match', reason: `same incident type "${a.incidentType}"` };
  }
  return {
    value: 'mismatch',
    reason: `different types "${a.incidentType}" vs "${b.incidentType}"`,
  };
}

function timeSignal(a: IncidentLike, b: IncidentLike): { value: TimeSignal; reason: string } {
  const hours = hoursBetween(a.reportedAt, b.reportedAt);
  if (hours <= SAME_DAY_HOURS) {
    return {
      value: 'same_day',
      reason: `reported within ${hours.toFixed(1)}h (≤ ${SAME_DAY_HOURS}h)`,
    };
  }
  if (hours <= SAME_WEEK_HOURS) {
    return {
      value: 'same_week',
      reason: `reported within ${hours.toFixed(1)}h (≤ ${SAME_WEEK_HOURS}h)`,
    };
  }
  return { value: 'older', reason: `reported ${hours.toFixed(1)}h apart (>) ${SAME_WEEK_HOURS}h` };
}

/**
 * Computes a deterministic, explainable duplicate evaluation for two incidents.
 * Returns null when neither incident is comparable (no shared identifier at all),
 * which the caller can treat as "not a candidate".
 */
export function evaluateDuplicate(
  target: IncidentLike,
  candidate: IncidentLike,
  threshold: number = DEFAULT_DUPLICATE_THRESHOLD,
): DuplicateEvaluation {
  const road = roadSignal(target, candidate);
  const kilometer = kilometerSignal(target, candidate);
  const incidentType = typeSignal(target, candidate);
  const similarity = jaccardSimilarity(target.description, candidate.description);
  const time = timeSignal(target, candidate);

  const description: { value: number; reason: string } = {
    value: similarity,
    reason: `normalized description similarity ${similarity.toFixed(2)}`,
  };

  const raw =
    ROAD_WEIGHTS[road.value] +
    KM_WEIGHTS[kilometer.value] +
    TYPE_WEIGHTS[incidentType.value] +
    DESCRIPTION_WEIGHT * similarity +
    TIME_WEIGHTS[time.value];

  const score = Math.max(0, Math.min(1, Math.round(raw * 100) / 100));

  const signals: DuplicateSignals = { road, kilometer, incidentType, description, time };

  return { score, isCandidate: score >= threshold, signals };
}

export function toDuplicateSignalsJson(signals: DuplicateSignals): Record<string, unknown> {
  return {
    road: signals.road,
    kilometer: signals.kilometer,
    incidentType: signals.incidentType,
    description: signals.description,
    time: signals.time,
  };
}

export type { Incident };
