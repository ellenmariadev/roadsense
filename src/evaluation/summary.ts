import { EVALUATION_CATEGORIES } from './evaluation.types';
import { EvaluationReport } from './evaluation.types';

function percentage(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function countAndRate(numerator: number, denominator: number, rate: number): string {
  return `${percentage(rate)} (${numerator}/${denominator})`;
}

function latency(value: number | null): string {
  return value === null ? 'not available' : `${value.toFixed(2)} ms`;
}

export function renderEvaluationSummary(report: EvaluationReport): string {
  const { metrics } = report;
  const lines: string[] = [];
  const unsupportedCases = report.cases
    .filter((result) => result.unsupportedFacts.length > 0)
    .map((result) => result.id);
  const invalidCases = report.cases
    .filter((result) => !result.validOutput)
    .map((result) => result.id);

  lines.push('# Road Sense AI Evaluation Summary', '');
  lines.push(`- Generated: ${report.generatedAt}`);
  lines.push(
    `- Execution: ${report.execution.mode} / ${report.execution.provider} / ${report.execution.model}`,
  );
  lines.push(`- Dataset: ${report.dataset.name} (${report.dataset.caseCount} fictional reports)`);
  lines.push(
    `- Categories: ${EVALUATION_CATEGORIES.map(
      (category) => `${category}=${report.dataset.categoryCounts[category]}`,
    ).join(', ')}`,
    '',
  );

  lines.push('## Measured results', '');
  lines.push('| Metric | Result |');
  lines.push('| --- | --- |');
  lines.push(
    `| Structured output validity | ${countAndRate(
      metrics.structuredOutputValidity.valid,
      metrics.structuredOutputValidity.total,
      metrics.structuredOutputValidity.rate,
    )} |`,
  );
  lines.push(
    `| Field extraction accuracy | ${countAndRate(
      metrics.fieldExtraction.correct,
      metrics.fieldExtraction.total,
      metrics.fieldExtraction.accuracy,
    )} |`,
  );
  lines.push(
    `| Incident type accuracy | ${countAndRate(
      metrics.incidentTypeClassification.correct,
      metrics.incidentTypeClassification.total,
      metrics.incidentTypeClassification.accuracy,
    )} |`,
  );
  lines.push(
    `| Missing information P / R / F1 | ${percentage(
      metrics.missingInformation.precision,
    )} / ${percentage(metrics.missingInformation.recall)} / ${percentage(
      metrics.missingInformation.f1,
    )} |`,
  );
  lines.push(
    `| Missing information exact match | ${countAndRate(
      metrics.missingInformation.exactMatches,
      metrics.missingInformation.total,
      metrics.missingInformation.exactMatchAccuracy,
    )} |`,
  );
  lines.push(
    `| Cases with unsupported facts | ${countAndRate(
      metrics.unsupportedFacts.casesWithUnsupportedFacts,
      metrics.unsupportedFacts.total,
      metrics.unsupportedFacts.caseRate,
    )} |`,
  );
  lines.push(`| Unsupported fact assertions | ${metrics.unsupportedFacts.assertions} |`);
  lines.push(
    `| Latency mean / p95 | ${latency(metrics.latency.meanMs)} / ${latency(
      metrics.latency.p95Ms,
    )} |`,
  );
  lines.push(
    `| Token usage | ${
      metrics.tokenUsage.available
        ? `${metrics.tokenUsage.totalTokens} total (${metrics.tokenUsage.casesWithUsage} cases)`
        : 'not available'
    } |`,
  );
  lines.push('');

  lines.push('### Field extraction by field', '');
  lines.push('| Field | Accuracy |');
  lines.push('| --- | --- |');
  for (const field of ['roadName', 'kilometerMarker', 'direction'] as const) {
    const fieldMetrics = metrics.fieldExtraction.perField[field];
    lines.push(
      `| ${field} | ${countAndRate(
        fieldMetrics.correct,
        fieldMetrics.total,
        fieldMetrics.accuracy,
      )} |`,
    );
  }
  lines.push('');

  lines.push('## Results by category', '');
  lines.push(
    '| Category | Cases | Valid output | Field accuracy | Type accuracy | Missing F1 | Missing exact | Unsupported cases |',
  );
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const category of EVALUATION_CATEGORIES) {
    const categoryMetrics = report.byCategory[category];
    lines.push(
      `| ${category} | ${categoryMetrics.caseCount} | ${percentage(
        categoryMetrics.structuredOutputValidity,
      )} | ${percentage(categoryMetrics.fieldExtractionAccuracy)} | ${percentage(
        categoryMetrics.incidentTypeAccuracy,
      )} | ${percentage(categoryMetrics.missingInformationF1)} | ${percentage(
        categoryMetrics.missingInformationExactMatchAccuracy,
      )} | ${percentage(categoryMetrics.unsupportedFactCaseRate)} |`,
    );
  }
  lines.push('');

  if (unsupportedCases.length > 0) {
    lines.push(`Cases with unsupported facts: ${unsupportedCases.join(', ')}`, '');
  }
  if (invalidCases.length > 0) {
    lines.push(`Cases with invalid structured output: ${invalidCases.join(', ')}`, '');
  }

  lines.push('## Notes and limitations', '');
  for (const limitation of report.limitations) {
    lines.push(`- ${limitation}`);
  }
  lines.push(
    '- These are measured results for the run above. No target threshold is asserted or implied.',
  );
  lines.push('');

  return lines.join('\n');
}
