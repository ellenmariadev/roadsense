import { LlmExecutionResult } from '../ai/llm-executor.service';
import { LlmExtraction } from '../ai/llm-provider.interface';
import { TimeoutError } from '../common/utils/with-timeout';
import { LlmOutputValidationError, LlmProviderError } from '../ai/llm-provider.interface';
import { validateTriageOutput } from '../ai/triage-output.dto';
import { EVALUATION_CASES, EVALUATION_DATASET_NAME } from './evaluation-dataset';
import {
  EVALUATION_CATEGORIES,
  EXTRACTED_FIELDS,
  EvaluationCase,
  EvaluationCaseResult,
  EvaluationCategory,
  EvaluationPrediction,
  EvaluationReport,
  EvaluationRunOptions,
} from './evaluation.types';
import {
  computeMetrics,
  computeMetricsByCategory,
  findUnsupportedFacts,
  matchesExpectedField,
  scoreMissingInformation,
} from './metrics';

export type EvaluationExecutor = (sourceText: string) => Promise<LlmExecutionResult>;

export const EVALUATION_LIMITATIONS = [
  'Field extraction is scored only for roadName, kilometerMarker and direction. Free-text description and riskFactors are retained in the report but not scored for correctness.',
  'Missing-information detection compares the field names reported by the model. Synonym or prose answers (for example "rodovia" instead of "roadName") count as misses.',
  'An unsupported fact is a non-empty structured location value when the expected value is unknown/null, not textually grounded in the report, or explicitly forbidden by the fixture. Wrong values that are textually grounded and expected to exist are scored as field errors, not hallucinations.',
  'Structured-output validity means the raw provider output passed the production triage schema validator. It does not prove semantic correctness.',
  'Latency is wall-clock time for this run and depends on hardware, network, provider load and retry behavior. Token counts are reported only when the provider exposes them.',
  'The dataset is fictional, small and curated for demonstration. It is not a statistical sample and does not establish production accuracy or fairness.',
  'No pass threshold is defined or implied. Results are measurements of the exact run recorded in this report.',
];

function emptyPrediction(): EvaluationPrediction {
  return {
    incidentType: null,
    roadName: null,
    kilometerMarker: null,
    direction: null,
    missingInformation: [],
    riskFactors: [],
    confidence: null,
    promptTokens: null,
    completionTokens: null,
  };
}

function zeroMissingInformation(expected: string[]) {
  return {
    expected: [
      ...new Set(expected.map((field) => field.trim().toLowerCase()).filter(Boolean)),
    ].sort(),
    predicted: [],
    matched: [],
    exactMatch: false,
    precision: 0,
    recall: 0,
    f1: 0,
  };
}

function safeErrorCode(error: unknown): string {
  if (error instanceof TimeoutError) return 'timeout';
  if (error instanceof LlmOutputValidationError) return 'schema-invalid';
  if (error instanceof LlmProviderError) return 'provider-error';
  return 'unexpected-error';
}

function failedResult(
  evaluationCase: EvaluationCase,
  error: string,
  latencyMs: number,
  attempts: number,
  extraction?: LlmExtraction,
): EvaluationCaseResult {
  const fieldCorrect = Object.fromEntries(
    EXTRACTED_FIELDS.map((field) => [field, false]),
  ) as Record<(typeof EXTRACTED_FIELDS)[number], boolean>;

  const prediction = emptyPrediction();
  prediction.promptTokens = extraction?.promptTokens ?? null;
  prediction.completionTokens = extraction?.completionTokens ?? null;

  return {
    id: evaluationCase.id,
    category: evaluationCase.category,
    report: evaluationCase.report,
    validOutput: false,
    error,
    predicted: prediction,
    expected: evaluationCase.expected,
    incidentTypeCorrect: false,
    fieldCorrect,
    missingInformation: zeroMissingInformation(evaluationCase.expected.missingInformation),
    unsupportedFacts: [],
    latencyMs,
    attempts,
  };
}

async function evaluateCase(
  evaluationCase: EvaluationCase,
  executor: EvaluationExecutor,
): Promise<EvaluationCaseResult> {
  const startedAt = Date.now();
  let execution: LlmExecutionResult;

  try {
    execution = await executor(evaluationCase.report);
  } catch (error) {
    return failedResult(evaluationCase, safeErrorCode(error), Date.now() - startedAt, 0);
  }

  let suggestion;
  try {
    suggestion = validateTriageOutput(execution.extraction.output);
  } catch (error) {
    return failedResult(
      evaluationCase,
      safeErrorCode(error),
      execution.latencyMs,
      execution.attempts,
      execution.extraction,
    );
  }

  const predicted: EvaluationPrediction = {
    incidentType: suggestion.incidentType ?? null,
    roadName: suggestion.roadName ?? null,
    kilometerMarker: suggestion.kilometerMarker ?? null,
    direction: suggestion.direction ?? null,
    missingInformation: suggestion.missingInformation ?? [],
    riskFactors: suggestion.riskFactors ?? [],
    confidence: suggestion.confidence ?? null,
    promptTokens: execution.extraction.promptTokens ?? null,
    completionTokens: execution.extraction.completionTokens ?? null,
  };

  const fieldCorrect = Object.fromEntries(
    EXTRACTED_FIELDS.map((field) => [
      field,
      matchesExpectedField(field, evaluationCase.expected[field], predicted[field]),
    ]),
  ) as Record<(typeof EXTRACTED_FIELDS)[number], boolean>;

  return {
    id: evaluationCase.id,
    category: evaluationCase.category,
    report: evaluationCase.report,
    validOutput: true,
    error: null,
    predicted,
    expected: evaluationCase.expected,
    incidentTypeCorrect: predicted.incidentType === evaluationCase.expected.incidentType,
    fieldCorrect,
    missingInformation: scoreMissingInformation(
      evaluationCase.expected.missingInformation,
      predicted.missingInformation,
    ),
    unsupportedFacts: findUnsupportedFacts(evaluationCase, predicted),
    latencyMs: execution.latencyMs,
    attempts: execution.attempts,
  };
}

export async function evaluateDataset(
  cases: readonly EvaluationCase[],
  executor: EvaluationExecutor,
  options: EvaluationRunOptions,
): Promise<EvaluationReport> {
  const results: EvaluationCaseResult[] = [];

  for (const evaluationCase of cases) {
    results.push(await evaluateCase(evaluationCase, executor));
  }

  const categoryCounts = Object.fromEntries(
    EVALUATION_CATEGORIES.map((category) => [
      category,
      cases.filter((evaluationCase) => evaluationCase.category === category).length,
    ]),
  ) as Record<EvaluationCategory, number>;

  return {
    schemaVersion: '1.0',
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    execution: {
      mode: options.mode,
      provider: options.provider,
      model: options.model,
      caseCount: cases.length,
    },
    dataset: {
      name: EVALUATION_DATASET_NAME,
      caseCount: cases.length,
      categoryCounts,
    },
    metrics: computeMetrics(results),
    byCategory: computeMetricsByCategory(results),
    cases: results,
    limitations: EVALUATION_LIMITATIONS,
  };
}

export async function runDefaultEvaluation(
  executor: EvaluationExecutor,
  options: EvaluationRunOptions,
): Promise<EvaluationReport> {
  return evaluateDataset(EVALUATION_CASES, executor, options);
}
