import { IncidentStatus } from '@prisma/client';
import { allowedTransitions, isTransitionAllowed } from './incident-state-machine';

describe('incident state machine', () => {
  it.each([
    [IncidentStatus.REPORTED, IncidentStatus.UNDER_REVIEW],
    [IncidentStatus.REPORTED, IncidentStatus.CONFIRMED],
    [IncidentStatus.UNDER_REVIEW, IncidentStatus.CONFIRMED],
    [IncidentStatus.CONFIRMED, IncidentStatus.IN_PROGRESS],
    [IncidentStatus.IN_PROGRESS, IncidentStatus.RESOLVED],
    [IncidentStatus.IN_PROGRESS, IncidentStatus.CANCELLED],
  ])('allows %s -> %s', (from, to) => {
    expect(isTransitionAllowed(from, to)).toBe(true);
  });

  it.each([
    [IncidentStatus.REPORTED, IncidentStatus.IN_PROGRESS],
    [IncidentStatus.REPORTED, IncidentStatus.RESOLVED],
    [IncidentStatus.CONFIRMED, IncidentStatus.RESOLVED],
    [IncidentStatus.RESOLVED, IncidentStatus.IN_PROGRESS],
    [IncidentStatus.CANCELLED, IncidentStatus.REPORTED],
  ])('rejects %s -> %s', (from, to) => {
    expect(isTransitionAllowed(from, to)).toBe(false);
  });

  it('keeps terminal statuses terminal', () => {
    expect(allowedTransitions(IncidentStatus.RESOLVED)).toEqual([]);
    expect(allowedTransitions(IncidentStatus.CANCELLED)).toEqual([]);
  });
});
