import { IncidentType } from '@prisma/client';
import {
  DEFAULT_DUPLICATE_THRESHOLD,
  evaluateDuplicate,
  extractKilometer,
  jaccardSimilarity,
  normalizeRoad,
  IncidentLike,
} from './duplicate-detection';

function incident(overrides: Partial<IncidentLike> = {}): IncidentLike {
  return {
    roadName: 'BR-116',
    kilometerMarker: '245',
    incidentType: IncidentType.ACCIDENT,
    description: 'Colisão entre dois veículos de passeio',
    reportedAt: new Date('2025-11-02T08:15:00.000Z'),
    ...overrides,
  };
}

describe('normalizeRoad', () => {
  it('normalizes case, accents, separators and whitespace', () => {
    expect(normalizeRoad('BR-116')).toBe('BR116');
    expect(normalizeRoad(' br 116 ')).toBe('BR116');
    expect(normalizeRoad('rodovia dos bandeirantes')).toBe('RODOVIADOSBANDEIRANTES');
    expect(normalizeRoad(null)).toBeNull();
  });
});

describe('extractKilometer', () => {
  it('extracts numeric markers from various formats', () => {
    expect(extractKilometer('245')).toBe(245);
    expect(extractKilometer('km 245')).toBe(245);
    expect(extractKilometer('245,5')).toBe(245.5);
    expect(extractKilometer('Km 12.5')).toBe(12.5);
    expect(extractKilometer('não informado')).toBeNull();
    expect(extractKilometer(null)).toBeNull();
  });
});

describe('jaccardSimilarity', () => {
  it('measures token overlap and ignores stopwords/accents', () => {
    expect(
      jaccardSimilarity('veículo quebrado na pista', 'veículo quebrado no acostamento'),
    ).toBeCloseTo(0.5);
    expect(jaccardSimilarity('completamente diferente', 'nada a ver')).toBe(0);
    expect(jaccardSimilarity(null, 'qualquer coisa')).toBe(0);
  });
});

describe('evaluateDuplicate', () => {
  it('flags a true candidate with a high, explainable score', () => {
    const target = incident();
    const candidate = incident({ description: 'Colisão de dois veículos na pista' });

    const result = evaluateDuplicate(target, candidate);

    expect(result.isCandidate).toBe(true);
    expect(result.score).toBeCloseTo(0.93);
    expect(result.signals.road.value).toBe('match');
    expect(result.signals.kilometer.value).toBe('match');
    expect(result.signals.incidentType.value).toBe('match');
    expect(result.signals.time.value).toBe('same_day');
    expect(result.signals.road.reason).toContain('BR116');
  });

  it('does not flag unrelated incidents', () => {
    const target = incident();
    const candidate = incident({
      roadName: 'SP-330',
      kilometerMarker: '900',
      incidentType: IncidentType.FLOODING,
      description: 'Alagamento severo na rodovia',
      reportedAt: new Date('2025-10-01T08:15:00.000Z'),
    });

    const result = evaluateDuplicate(target, candidate);

    expect(result.isCandidate).toBe(false);
    expect(result.score).toBe(0);
    expect(result.signals.road.value).toBe('mismatch');
    expect(result.signals.incidentType.value).toBe('mismatch');
  });

  it('degrades gracefully when location data is missing (not a false match)', () => {
    const target = incident();
    const candidate = incident({
      roadName: null,
      kilometerMarker: null,
      description: 'Colisão de dois veículos na pista',
    });

    const result = evaluateDuplicate(target, candidate);

    expect(result.signals.road.value).toBe('missing');
    expect(result.signals.kilometer.value).toBe('missing');
    expect(result.isCandidate).toBe(false);
    expect(result.score).toBeCloseTo(0.38);
  });

  it('treats kilometer markers within tolerance as near and beyond as mismatch', () => {
    const base = incident();

    const near = evaluateDuplicate(base, incident({ kilometerMarker: '247' })); // diff 2
    expect(near.signals.kilometer.value).toBe('near');

    const far = evaluateDuplicate(base, incident({ kilometerMarker: '248' })); // diff 3
    expect(far.signals.kilometer.value).toBe('mismatch');
  });

  it('distinguishes the 24h time boundary', () => {
    const target = incident({ reportedAt: new Date('2025-11-02T00:00:00.000Z') });

    const sameDay = evaluateDuplicate(
      target,
      incident({ reportedAt: new Date('2025-11-03T00:00:00.000Z') }),
    );
    expect(sameDay.signals.time.value).toBe('same_day');

    const sameWeek = evaluateDuplicate(
      target,
      incident({ reportedAt: new Date('2025-11-03T01:00:00.000Z') }),
    );
    expect(sameWeek.signals.time.value).toBe('same_week');

    const older = evaluateDuplicate(
      target,
      incident({ reportedAt: new Date('2025-11-12T00:00:00.000Z') }),
    );
    expect(older.signals.time.value).toBe('older');
  });

  it('treats generic OTHER type as a weak signal and null type as missing', () => {
    const target = incident({ incidentType: IncidentType.OTHER });

    const generic = evaluateDuplicate(target, incident({ incidentType: IncidentType.OTHER }));
    expect(generic.signals.incidentType.value).toBe('generic_match');

    const missing = evaluateDuplicate(target, incident({ incidentType: null }));
    expect(missing.signals.incidentType.value).toBe('missing');
  });

  it('uses a score >= threshold boundary as candidate', () => {
    // road match (+0.35) + km match (+0.20) + type missing (0) + desc 0 + same_day (+0.10) = 0.65
    const target = incident({ incidentType: null, description: null });
    const candidate = incident({ incidentType: null, description: null });

    const result = evaluateDuplicate(target, candidate, DEFAULT_DUPLICATE_THRESHOLD);
    expect(result.score).toBeCloseTo(0.65);
    expect(result.isCandidate).toBe(true);
  });
});
