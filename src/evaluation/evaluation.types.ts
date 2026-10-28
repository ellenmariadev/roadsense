import { IncidentType } from '@prisma/client';

export const EVALUATION_CATEGORIES = [
  'straightforward',
  'ambiguous',
  'incomplete',
  'contradictory',
  'irrelevant',
  'adversarial',
] as const;

export type EvaluationCategory = (typeof EVALUATION_CATEGORIES)[number];

export const EXTRACTED_FIELDS = ['roadName', 'kilometerMarker', 'direction'] as const;

export type ExtractedField = (typeof EXTRACTED_FIELDS)[number];

export interface EvaluationExpectation {
  incidentType: IncidentType;
  roadName: string | null;
  kilometerMarker: string | null;
  direction: string | null;
  missingInformation: string[];
  forbiddenValues: string[];
}

export interface EvaluationCase {
  id: string;
  category: EvaluationCategory;
  report: string;
  expected: EvaluationExpectation;
}

export interface EvaluationPrediction {
  incidentType: IncidentType | null;
  roadName: string | null;
  kilometerMarker: string | null;
  direction: string | null;
  missingInformation: string[];
  riskFactors: string[];
  confidence: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
}

export interface MissingInformationScore {
  expected: string[];
  predicted: string[];
  matched: string[];
  exactMatch: boolean;
  precision: number;
  recall: number;
  f1: number;
}

export interface EvaluationCaseResult {
  id: string;
  category: EvaluationCategory;
  report: string;
  validOutput: boolean;
  error: string | null;
  predicted: EvaluationPrediction;
  expected: EvaluationExpectation;
  incidentTypeCorrect: boolean;
  fieldCorrect: Record<ExtractedField, boolean>;
  missingInformation: MissingInformationScore;
  unsupportedFacts: string[];
  latencyMs: number;
  attempts: number;
}

export interface StructuredOutputValidityMetric {
  valid: number;
  total: number;
  rate: number;
}

export interface FieldExtractionMetric {
  correct: number;
  total: number;
  accuracy: number;
  perField: Record<ExtractedField, { correct: number; total: number; accuracy: number }>;
}

export interface IncidentTypeMetric {
  correct: number;
  total: number;
  accuracy: number;
}

export interface MissingInformationMetric {
  matched: number;
  expected: number;
  predicted: number;
  precision: number;
  recall: number;
  f1: number;
  exactMatches: number;
  total: number;
  exactMatchAccuracy: number;
}

export interface UnsupportedFactsMetric {
  assertions: number;
  casesWithUnsupportedFacts: number;
  caseRate: number;
  total: number;
  byField: Record<ExtractedField, number>;
}

export interface LatencyMetric {
  measured: number;
  meanMs: number | null;
  medianMs: number | null;
  p95Ms: number | null;
  minMs: number | null;
  maxMs: number | null;
  totalMs: number;
}

export interface TokenUsageMetric {
  available: boolean;
  casesWithUsage: number;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
}

export interface EvaluationMetrics {
  structuredOutputValidity: StructuredOutputValidityMetric;
  fieldExtraction: FieldExtractionMetric;
  incidentTypeClassification: IncidentTypeMetric;
  missingInformation: MissingInformationMetric;
  unsupportedFacts: UnsupportedFactsMetric;
  latency: LatencyMetric;
  tokenUsage: TokenUsageMetric;
}

export interface CategoryMetrics {
  caseCount: number;
  structuredOutputValidity: number;
  fieldExtractionAccuracy: number;
  incidentTypeAccuracy: number;
  missingInformationF1: number;
  missingInformationExactMatchAccuracy: number;
  unsupportedFactCaseRate: number;
}

export interface EvaluationReport {
  schemaVersion: '1.0';
  generatedAt: string;
  execution: {
    mode: 'mock' | 'real' | 'fixture' | 'runtime';
    provider: string;
    model: string;
    caseCount: number;
  };
  dataset: {
    name: string;
    caseCount: number;
    categoryCounts: Record<EvaluationCategory, number>;
  };
  metrics: EvaluationMetrics;
  byCategory: Record<EvaluationCategory, CategoryMetrics>;
  cases: EvaluationCaseResult[];
  limitations: string[];
}

export interface EvaluationRunOptions {
  mode: EvaluationReport['execution']['mode'];
  provider: string;
  model: string;
  generatedAt?: string;
}
