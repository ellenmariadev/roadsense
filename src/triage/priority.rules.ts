import { IncidentType, Priority } from '@prisma/client';

/**
 * Deterministic priority rules. Operational priority is computed by the
 * application from validated incident attributes — never decided by the LLM.
 *
 * Rules (documented and unit-tested in `priority.rules.spec.ts`):
 * 1. Any CRITICAL risk factor escalates to CRITICAL.
 * 2. Otherwise any HIGH risk factor escalates to HIGH.
 * 3. Otherwise the incident type base priority applies:
 *    ACCIDENT / FLOODING -> HIGH; breakdown/obstruction/damage -> MEDIUM;
 *    OTHER or unknown -> LOW.
 */

const CRITICAL_RISK_KEYWORDS = [
  'vítima',
  'vitima',
  'fatal',
  'fatalidade',
  'bloqueio total',
  'pista interditada',
  'intransitável',
  'intransitavel',
];

const HIGH_RISK_KEYWORDS = [
  'bloqueio de faixa',
  'bloqueio parcial',
  'incêndio',
  'incendio',
  'vazamento',
  'risco de explosão',
];

export function calculatePriority(
  incidentType: IncidentType | null,
  riskFactors: string[] = [],
): Priority {
  const normalized = riskFactors.map((factor) => factor.toLowerCase());

  const matches = (keywords: string[]): boolean =>
    normalized.some((factor) => keywords.some((keyword) => factor.includes(keyword)));

  if (matches(CRITICAL_RISK_KEYWORDS)) {
    return Priority.CRITICAL;
  }

  if (matches(HIGH_RISK_KEYWORDS)) {
    return Priority.HIGH;
  }

  switch (incidentType) {
    case IncidentType.ACCIDENT:
    case IncidentType.FLOODING:
      return Priority.HIGH;
    case IncidentType.VEHICLE_BREAKDOWN:
    case IncidentType.ROAD_OBSTRUCTION:
    case IncidentType.INFRASTRUCTURE_DAMAGE:
      return Priority.MEDIUM;
    case IncidentType.OTHER:
    case null:
    default:
      return Priority.LOW;
  }
}
