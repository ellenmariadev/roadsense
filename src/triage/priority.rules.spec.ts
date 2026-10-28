import { IncidentType, Priority } from '@prisma/client';
import { calculatePriority } from './priority.rules';

describe('calculatePriority', () => {
  it('returns LOW for an unknown type with no risk factors', () => {
    expect(calculatePriority(null, [])).toBe(Priority.LOW);
  });

  it.each([
    [IncidentType.ACCIDENT, Priority.HIGH],
    [IncidentType.FLOODING, Priority.HIGH],
    [IncidentType.VEHICLE_BREAKDOWN, Priority.MEDIUM],
    [IncidentType.ROAD_OBSTRUCTION, Priority.MEDIUM],
    [IncidentType.INFRASTRUCTURE_DAMAGE, Priority.MEDIUM],
    [IncidentType.OTHER, Priority.LOW],
  ])('maps type %s to base priority %s', (type, expected) => {
    expect(calculatePriority(type, [])).toBe(expected);
  });

  it('escalates to CRITICAL on critical risk factors', () => {
    expect(calculatePriority(IncidentType.VEHICLE_BREAKDOWN, ['vítimas'])).toBe(Priority.CRITICAL);
    expect(calculatePriority(IncidentType.OTHER, ['pista interditada'])).toBe(Priority.CRITICAL);
  });

  it('escalates to HIGH on high risk factors', () => {
    expect(calculatePriority(IncidentType.OTHER, ['bloqueio de faixa'])).toBe(Priority.HIGH);
    expect(calculatePriority(IncidentType.VEHICLE_BREAKDOWN, ['vazamento'])).toBe(Priority.HIGH);
  });

  it('is case-insensitive for risk factor keywords', () => {
    expect(calculatePriority(IncidentType.OTHER, ['VÍTIMAS'])).toBe(Priority.CRITICAL);
  });

  it('does not downgrade a HIGH base type when risk factors are absent', () => {
    expect(calculatePriority(IncidentType.ACCIDENT, [])).toBe(Priority.HIGH);
  });
});
