import {
  CategoryMetrics,
  EVALUATION_CATEGORIES,
  EXTRACTED_FIELDS,
  EvaluationCase,
  EvaluationCategory,
  EvaluationCaseResult,
  EvaluationMetrics,
  EvaluationPrediction,
  ExtractedField,
  MissingInformationScore,
} from './evaluation.types';

function round(value: number, digits = 6): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : round(numerator / denominator);
}

function compact(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function normalizedWords(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeFieldValue(field: ExtractedField, value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (field === 'kilometerMarker') {
    const numeric = Number(trimmed.replace(',', '.'));
    if (Number.isFinite(numeric)) return String(numeric);
    return compact(trimmed);
  }

  if (field === 'roadName') {
    return compact(trimmed);
  }

  return compact(trimmed);
}

function isTextuallyGrounded(field: ExtractedField, value: string, source: string): boolean {
  const sourceWords = normalizedWords(source);
  const valueWords = normalizedWords(value);
  if (!valueWords) return false;

  if (field === 'direction') {
    return sourceWords.split(' ').includes(valueWords);
  }

  return sourceWords.replace(/ /g, '').includes(valueWords.replace(/ /g, ''));
}

export function matchesExpectedField(
  field: ExtractedField,
  expected: string | null,
  predicted: string | null,
): boolean {
  return normalizeFieldValue(field, expected) === normalizeFieldValue(field, predicted);
}

export function findUnsupportedFacts(
  evaluationCase: EvaluationCase,
  predicted: EvaluationPrediction,
): string[] {
  const unsupported: string[] = [];

  for (const field of EXTRACTED_FIELDS) {
    const value = predicted[field];
    if (!value) continue;

    const forbidden = evaluationCase.expected.forbiddenValues.some(
      (candidate) => normalizeFieldValue(field, candidate) === normalizeFieldValue(field, value),
    );
    const expectedKnown = evaluationCase.expected[field] !== null;
    const grounded = isTextuallyGrounded(field, value, evaluationCase.report);

    if (forbidden || !expectedKnown || !grounded) {
      unsupported.push(`${field}:${value}`);
    }
  }

  return unsupported;
}

export function scoreMissingInformation(
  expected: string[],
  predicted: string[],
): MissingInformationScore {
  const expectedSet = new Set(expected.map((field) => field.trim().toLowerCase()).filter(Boolean));
  const predictedSet = new Set(
    predicted.map((field) => field.trim().toLowerCase()).filter(Boolean),
  );

  const matchedSet = new Set([...expectedSet].filter((field) => predictedSet.has(field)));

  const matched = matchedSet.size;
  let precision = 0;
  if (predictedSet.size === 0) {
    precision = expectedSet.size === 0 ? 1 : 0;
  } else {
    precision = round(matched / predictedSet.size);
  }

  const recall = expectedSet.size === 0 ? 1 : round(matched / expectedSet.size);
  const f1 = precision + recall === 0 ? 0 : round((2 * precision * recall) / (precision + recall));
  const exactMatch =
    expectedSet.size === predictedSet.size &&
    [...expectedSet].every((field) => predictedSet.has(field));

  return {
    expected: [...expectedSet].sort(),
    predicted: [...predictedSet].sort(),
    matched: [...matchedSet].sort(),
    exactMatch,
    precision,
    recall,
    f1,
  };
}

function median(sorted: number[]): number | null {
  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return round((sorted[middle - 1] + sorted[middle]) / 2, 2);
}

function percentile(sorted: number[], percentileValue: number): number | null {
  if (sorted.length === 0) return null;
  const index = Math.max(0, Math.ceil(percentileValue * sorted.length) - 1);
  return sorted[index];
}

export function computeMetrics(results: EvaluationCaseResult[]): EvaluationMetrics {
  const total = results.length;
  const valid = results.filter((result) => result.validOutput).length;

  const fieldTotals = Object.fromEntries(
    EXTRACTED_FIELDS.map((field) => [field, { correct: 0, total }]),
  ) as Record<ExtractedField, { correct: number; total: number }>;

  let fieldCorrect = 0;
  let fieldTotal = 0;
  let incidentTypeCorrect = 0;
  let missingMatched = 0;
  let missingExpected = 0;
  let missingPredicted = 0;
  let missingExactMatches = 0;
  let unsupportedAssertions = 0;
  let unsupportedCases = 0;
  const unsupportedByField = Object.fromEntries(
    EXTRACTED_FIELDS.map((field) => [field, 0]),
  ) as Record<ExtractedField, number>;

  const latencies: number[] = [];
  let promptTokens = 0;
  let completionTokens = 0;
  let promptTokensAvailable = false;
  let completionTokensAvailable = false;
  let casesWithUsage = 0;

  for (const result of results) {
    incidentTypeCorrect += result.incidentTypeCorrect ? 1 : 0;

    for (const field of EXTRACTED_FIELDS) {
      const correct = result.fieldCorrect[field];
      fieldTotals[field].correct += correct ? 1 : 0;
      fieldCorrect += correct ? 1 : 0;
      fieldTotal += 1;
    }

    missingMatched += result.missingInformation.matched.length;
    missingExpected += result.missingInformation.expected.length;
    missingPredicted += result.missingInformation.predicted.length;
    missingExactMatches += result.missingInformation.exactMatch ? 1 : 0;

    unsupportedAssertions += result.unsupportedFacts.length;
    unsupportedCases += result.unsupportedFacts.length > 0 ? 1 : 0;
    for (const fact of result.unsupportedFacts) {
      const field = fact.split(':')[0] as ExtractedField;
      if (field in unsupportedByField) unsupportedByField[field] += 1;
    }

    if (Number.isFinite(result.latencyMs)) {
      latencies.push(result.latencyMs);
    }

    if (result.predicted.promptTokens !== null) {
      promptTokens += result.predicted.promptTokens;
      promptTokensAvailable = true;
      casesWithUsage += 1;
    }
    if (result.predicted.completionTokens !== null) {
      completionTokens += result.predicted.completionTokens;
      completionTokensAvailable = true;
      if (result.predicted.promptTokens === null) casesWithUsage += 1;
    }
  }

  const sortedLatencies = [...latencies].sort((a, b) => a - b);
  const latencyTotal = sortedLatencies.reduce((sum, value) => sum + value, 0);
  const missingPrecision =
    missingPredicted === 0 ? (missingExpected === 0 ? 1 : 0) : missingMatched / missingPredicted;
  const missingRecall = missingExpected === 0 ? 1 : missingMatched / missingExpected;
  const missingF1 =
    missingPrecision + missingRecall === 0
      ? 0
      : (2 * missingPrecision * missingRecall) / (missingPrecision + missingRecall);
  const tokenUsageAvailable = promptTokensAvailable || completionTokensAvailable;

  return {
    structuredOutputValidity: {
      valid,
      total,
      rate: ratio(valid, total),
    },
    fieldExtraction: {
      correct: fieldCorrect,
      total: fieldTotal,
      accuracy: ratio(fieldCorrect, fieldTotal),
      perField: Object.fromEntries(
        EXTRACTED_FIELDS.map((field) => [
          field,
          {
            correct: fieldTotals[field].correct,
            total: fieldTotals[field].total,
            accuracy: ratio(fieldTotals[field].correct, fieldTotals[field].total),
          },
        ]),
      ) as Record<ExtractedField, { correct: number; total: number; accuracy: number }>,
    },
    incidentTypeClassification: {
      correct: incidentTypeCorrect,
      total,
      accuracy: ratio(incidentTypeCorrect, total),
    },
    missingInformation: {
      matched: missingMatched,
      expected: missingExpected,
      predicted: missingPredicted,
      precision: round(missingPrecision),
      recall: round(missingRecall),
      f1: round(missingF1),
      exactMatches: missingExactMatches,
      total,
      exactMatchAccuracy: ratio(missingExactMatches, total),
    },
    unsupportedFacts: {
      assertions: unsupportedAssertions,
      casesWithUnsupportedFacts: unsupportedCases,
      caseRate: ratio(unsupportedCases, total),
      total,
      byField: unsupportedByField,
    },
    latency: {
      measured: sortedLatencies.length,
      meanMs: sortedLatencies.length === 0 ? null : round(latencyTotal / sortedLatencies.length, 2),
      medianMs: median(sortedLatencies),
      p95Ms: percentile(sortedLatencies, 0.95),
      minMs: sortedLatencies.length === 0 ? null : sortedLatencies[0],
      maxMs: sortedLatencies.length === 0 ? null : sortedLatencies[sortedLatencies.length - 1],
      totalMs: latencyTotal,
    },
    tokenUsage: {
      available: tokenUsageAvailable,
      casesWithUsage: tokenUsageAvailable ? casesWithUsage : 0,
      promptTokens: promptTokensAvailable ? promptTokens : null,
      completionTokens: completionTokensAvailable ? completionTokens : null,
      totalTokens: tokenUsageAvailable ? promptTokens + completionTokens : null,
    },
  };
}

export function computeMetricsByCategory(
  results: EvaluationCaseResult[],
): Record<EvaluationCategory, CategoryMetrics> {
  return Object.fromEntries(
    EVALUATION_CATEGORIES.map((category) => {
      const subset = results.filter((result) => result.category === category);
      const metrics = computeMetrics(subset);
      return [
        category,
        {
          caseCount: subset.length,
          structuredOutputValidity: metrics.structuredOutputValidity.rate,
          fieldExtractionAccuracy: metrics.fieldExtraction.accuracy,
          incidentTypeAccuracy: metrics.incidentTypeClassification.accuracy,
          missingInformationF1: metrics.missingInformation.f1,
          missingInformationExactMatchAccuracy: metrics.missingInformation.exactMatchAccuracy,
          unsupportedFactCaseRate: metrics.unsupportedFacts.caseRate,
        },
      ];
    }),
  ) as Record<EvaluationCategory, CategoryMetrics>;
}
