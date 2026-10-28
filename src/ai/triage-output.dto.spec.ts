import { IncidentType } from '@prisma/client';
import { LlmOutputValidationError } from './llm-provider.interface';
import { validateTriageOutput } from './triage-output.dto';

describe('validateTriageOutput', () => {
  it('accepts a valid output and preserves extracted fields', () => {
    const result = validateTriageOutput({
      incidentType: 'ACCIDENT',
      description: 'Colisão entre veículos',
      locationText: 'BR-116, km 245',
      roadName: 'BR-116',
      kilometerMarker: '245',
      direction: 'sul',
      riskFactors: ['vítimas'],
      confidence: 0.9,
      missingInformation: [],
      sourceText: 'relato original',
    });

    expect(result.incidentType).toBe(IncidentType.ACCIDENT);
    expect(result.roadName).toBe('BR-116');
    expect(result.confidence).toBe(0.9);
  });

  it('rejects malformed output (non-object JSON)', () => {
    expect(() => validateTriageOutput('just a string')).toThrow(LlmOutputValidationError);
    expect(() => validateTriageOutput(null)).toThrow(LlmOutputValidationError);
    expect(() => validateTriageOutput([1, 2, 3])).toThrow(LlmOutputValidationError);
  });

  it('preserves missing optional fields as undefined (not a failure)', () => {
    const result = validateTriageOutput({});
    expect(result.incidentType).toBeUndefined();
    expect(result.roadName).toBeUndefined();
    expect(result.confidence).toBeUndefined();
  });

  it('preserves partial output with missing fields', () => {
    const result = validateTriageOutput({ incidentType: 'FLOODING' });
    expect(result.incidentType).toBe(IncidentType.FLOODING);
    expect(result.description).toBeUndefined();
  });

  it('rejects an unsupported incident type claim (invalid enum)', () => {
    expect(() => validateTriageOutput({ incidentType: 'EXPLOSION' })).toThrow(
      LlmOutputValidationError,
    );
  });

  it('rejects unsupported/unknown fields (e.g. executable content)', () => {
    expect(() =>
      validateTriageOutput({
        incidentType: 'ACCIDENT',
        sql: 'DROP TABLE incidents;',
      }),
    ).toThrow(LlmOutputValidationError);

    expect(() =>
      validateTriageOutput({
        incidentType: 'ACCIDENT',
        command: 'rm -rf /',
      }),
    ).toThrow(LlmOutputValidationError);
  });

  it('rejects invalid field types (confidence as string, riskFactors as string)', () => {
    expect(() => validateTriageOutput({ confidence: '0.8' })).toThrow(LlmOutputValidationError);
    expect(() => validateTriageOutput({ riskFactors: 'vítimas' })).toThrow(
      LlmOutputValidationError,
    );
  });

  it('rejects confidence out of range', () => {
    expect(() => validateTriageOutput({ confidence: 1.5 })).toThrow(LlmOutputValidationError);
    expect(() => validateTriageOutput({ confidence: -0.1 })).toThrow(LlmOutputValidationError);
  });
});
