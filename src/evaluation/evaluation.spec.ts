import { IncidentType } from '@prisma/client';
import { LlmExtraction } from '../ai/llm-provider.interface';
import { MockLlmProvider } from '../ai/mock-llm.provider';
import { EVALUATION_CASES } from './evaluation-dataset';
import { evaluateDataset, EvaluationExecutor } from './evaluation-runner';
import { renderEvaluationSummary } from './summary';
import { EVALUATION_CATEGORIES, EvaluationCase } from './evaluation.types';

function fixtureCase(
  id: string,
  report: string,
  expected: EvaluationCase['expected'],
): EvaluationCase {
  return {
    id,
    category: 'straightforward',
    report,
    expected,
  };
}

function extraction(output: unknown): LlmExtraction {
  return {
    output,
    provider: 'fixture',
    model: 'fixture-v1',
    promptTokens: 10,
    completionTokens: 5,
  };
}

describe('evaluation dataset', () => {
  it('contains at least 40 unique fictional cases across every required category', () => {
    expect(EVALUATION_CASES.length).toBeGreaterThanOrEqual(40);

    const ids = EVALUATION_CASES.map((evaluationCase) => evaluationCase.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const category of EVALUATION_CATEGORIES) {
      expect(EVALUATION_CASES.some((evaluationCase) => evaluationCase.category === category)).toBe(
        true,
      );
    }

    for (const evaluationCase of EVALUATION_CASES) {
      expect(evaluationCase.report.trim().length).toBeGreaterThan(0);
      expect(Object.values(IncidentType)).toContain(evaluationCase.expected.incidentType);

      const expectedMissing = ['roadName', 'kilometerMarker', 'direction']
        .filter((field) => evaluationCase.expected[field as 'roadName'] === null)
        .sort();
      expect([...evaluationCase.expected.missingInformation].sort()).toEqual(expectedMissing);
    }
  });
});

describe('evaluateDataset with the deterministic mock provider', () => {
  it('produces identical measured reports for identical fixtures', async () => {
    const provider = new MockLlmProvider();
    const executor: EvaluationExecutor = async (sourceText) => ({
      extraction: await provider.extract(sourceText),
      latencyMs: 0,
      attempts: 1,
    });
    const options = {
      mode: 'fixture' as const,
      provider: 'mock',
      model: provider.model,
      generatedAt: '2026-01-01T00:00:00.000Z',
    };

    const first = await evaluateDataset(EVALUATION_CASES, executor, options);
    const second = await evaluateDataset(EVALUATION_CASES, executor, options);

    expect(first).toEqual(second);
    expect(first.cases).toHaveLength(EVALUATION_CASES.length);
    expect(first.metrics.structuredOutputValidity.valid).toBe(EVALUATION_CASES.length);
    expect(first.metrics.structuredOutputValidity.rate).toBe(1);
    expect(first.metrics.tokenUsage.available).toBe(true);
    expect(first.metrics.tokenUsage.casesWithUsage).toBe(EVALUATION_CASES.length);
    expect(first.metrics.latency.measured).toBe(EVALUATION_CASES.length);
    expect(first.metrics.latency.totalMs).toBe(0);
  });

  it('reports measured values without asserting a success target', async () => {
    const provider = new MockLlmProvider();
    const report = await evaluateDataset(
      EVALUATION_CASES,
      async (sourceText) => ({
        extraction: await provider.extract(sourceText),
        latencyMs: 1,
        attempts: 1,
      }),
      {
        mode: 'fixture',
        provider: 'mock',
        model: provider.model,
        generatedAt: '2026-01-01T00:00:00.000Z',
      },
    );

    expect(report.metrics.incidentTypeClassification.accuracy).toBeGreaterThanOrEqual(0);
    expect(report.metrics.incidentTypeClassification.accuracy).toBeLessThanOrEqual(1);
    expect(report.metrics.fieldExtraction.accuracy).toBeGreaterThanOrEqual(0);
    expect(report.metrics.fieldExtraction.accuracy).toBeLessThanOrEqual(1);
    expect(report.metrics.missingInformation.f1).toBeGreaterThanOrEqual(0);
    expect(report.metrics.missingInformation.f1).toBeLessThanOrEqual(1);
    expect(report.limitations.length).toBeGreaterThan(0);

    const summary = renderEvaluationSummary(report);
    expect(summary).toContain('Structured output validity');
    expect(summary).toContain('No target threshold is asserted or implied.');
  });
});

describe('evaluation metrics with scripted fixtures', () => {
  it('computes validity, extraction, classification, missing, unsupported, latency and tokens', async () => {
    const cases: EvaluationCase[] = [
      fixtureCase('F1', 'Colisão na BR-116 km 245 sentido sul.', {
        incidentType: IncidentType.ACCIDENT,
        roadName: 'BR-116',
        kilometerMarker: '245',
        direction: 'sul',
        missingInformation: [],
        forbiddenValues: [],
      }),
      fixtureCase('F2', 'Alagamento na SP-330 km 88 sentido norte.', {
        incidentType: IncidentType.FLOODING,
        roadName: 'SP-330',
        kilometerMarker: '88',
        direction: 'norte',
        missingInformation: [],
        forbiddenValues: [],
      }),
      fixtureCase('F3', 'Nada relevante foi reportado.', {
        incidentType: IncidentType.OTHER,
        roadName: null,
        kilometerMarker: null,
        direction: null,
        missingInformation: ['roadName', 'kilometerMarker', 'direction'],
        forbiddenValues: [],
      }),
      fixtureCase('F4', 'Relato sem dados úteis.', {
        incidentType: IncidentType.ACCIDENT,
        roadName: null,
        kilometerMarker: null,
        direction: null,
        missingInformation: [],
        forbiddenValues: [],
      }),
    ];

    const outputs: Record<string, unknown> = {
      'Colisão na BR-116 km 245 sentido sul.': {
        incidentType: 'ACCIDENT',
        roadName: 'BR-116',
        kilometerMarker: '245',
        direction: 'sul',
        missingInformation: [],
      },
      'Alagamento na SP-330 km 88 sentido norte.': {
        incidentType: 'ACCIDENT',
        roadName: 'SP-330',
        kilometerMarker: '88',
        direction: 'norte',
        missingInformation: ['roadName'],
      },
      'Nada relevante foi reportado.': {
        incidentType: 'OTHER',
        roadName: 'BR-999',
        kilometerMarker: '999',
        direction: null,
        missingInformation: ['roadName', 'kilometerMarker', 'direction'],
      },
      'Relato sem dados úteis.': 'not-a-json-object',
    };
    const latencies: Record<string, number> = {
      'Colisão na BR-116 km 245 sentido sul.': 10,
      'Alagamento na SP-330 km 88 sentido norte.': 20,
      'Nada relevante foi reportado.': 30,
      'Relato sem dados úteis.': 40,
    };

    const report = await evaluateDataset(
      cases,
      async (sourceText) => ({
        extraction: extraction(outputs[sourceText]),
        latencyMs: latencies[sourceText],
        attempts: 1,
      }),
      {
        mode: 'fixture',
        provider: 'fixture',
        model: 'fixture-v1',
        generatedAt: '2026-01-01T00:00:00.000Z',
      },
    );

    expect(report.metrics.structuredOutputValidity).toMatchObject({
      valid: 3,
      total: 4,
      rate: 0.75,
    });

    expect(report.metrics.fieldExtraction.correct).toBe(7);
    expect(report.metrics.fieldExtraction.total).toBe(12);
    expect(report.metrics.fieldExtraction.accuracy).toBe(0.583333);
    expect(report.metrics.fieldExtraction.perField.roadName).toMatchObject({
      correct: 2,
      total: 4,
      accuracy: 0.5,
    });
    expect(report.metrics.fieldExtraction.perField.kilometerMarker).toMatchObject({
      correct: 2,
      total: 4,
      accuracy: 0.5,
    });
    expect(report.metrics.fieldExtraction.perField.direction).toMatchObject({
      correct: 3,
      total: 4,
      accuracy: 0.75,
    });

    expect(report.metrics.incidentTypeClassification).toMatchObject({
      correct: 2,
      total: 4,
      accuracy: 0.5,
    });

    expect(report.metrics.missingInformation).toMatchObject({
      matched: 3,
      expected: 3,
      predicted: 4,
      precision: 0.75,
      recall: 1,
      f1: 0.857143,
      exactMatches: 2,
      total: 4,
      exactMatchAccuracy: 0.5,
    });

    expect(report.metrics.unsupportedFacts).toMatchObject({
      assertions: 2,
      casesWithUnsupportedFacts: 1,
      caseRate: 0.25,
      total: 4,
      byField: {
        roadName: 1,
        kilometerMarker: 1,
        direction: 0,
      },
    });

    expect(report.metrics.latency).toMatchObject({
      measured: 4,
      meanMs: 25,
      medianMs: 25,
      p95Ms: 40,
      minMs: 10,
      maxMs: 40,
      totalMs: 100,
    });

    expect(report.metrics.tokenUsage).toMatchObject({
      available: true,
      casesWithUsage: 4,
      promptTokens: 40,
      completionTokens: 20,
      totalTokens: 60,
    });

    const invalid = report.cases.find((result) => result.id === 'F4');
    expect(invalid).toMatchObject({
      validOutput: false,
      error: 'schema-invalid',
      incidentTypeCorrect: false,
    });
    expect(invalid?.unsupportedFacts).toEqual([]);
    expect(invalid?.missingInformation).toMatchObject({
      precision: 0,
      recall: 0,
      f1: 0,
      exactMatch: false,
    });
  });

  it('serializes to a machine-readable JSON report', async () => {
    const provider = new MockLlmProvider();
    const report = await evaluateDataset(
      EVALUATION_CASES,
      async (sourceText) => ({
        extraction: await provider.extract(sourceText),
        latencyMs: 1,
        attempts: 1,
      }),
      {
        mode: 'fixture',
        provider: 'mock',
        model: provider.model,
        generatedAt: '2026-01-01T00:00:00.000Z',
      },
    );

    const parsed = JSON.parse(JSON.stringify(report));

    expect(parsed.schemaVersion).toBe('1.0');
    expect(parsed.cases).toHaveLength(EVALUATION_CASES.length);
    expect(parsed.metrics.structuredOutputValidity.total).toBe(EVALUATION_CASES.length);
    expect(parsed.limitations).toEqual(report.limitations);
  });
});
