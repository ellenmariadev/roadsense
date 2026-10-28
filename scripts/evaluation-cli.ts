import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ConfigService } from '@nestjs/config';
import { LlmExecutorService } from '../src/ai/llm-executor.service';
import { LlmProvider } from '../src/ai/llm-provider.interface';
import { EvaluationReport } from '../src/evaluation/evaluation.types';
import { renderEvaluationSummary } from '../src/evaluation/summary';

export const DEFAULT_OUT_DIR = path.resolve(process.cwd(), 'evaluation', 'reports');

export function parseNonNegativeInteger(value: string, flag: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${flag} must be a non-negative integer`);
  }
  return parsed;
}

export function takeValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

export function createExecutor(
  provider: LlmProvider,
  timeoutMs: number,
  maxRetries: number,
): LlmExecutorService {
  const config = {
    get: (key: string, defaultValue?: unknown): unknown => {
      if (key === 'llm.timeoutMs') return timeoutMs;
      if (key === 'llm.maxRetries') return maxRetries;
      return defaultValue;
    },
  } as unknown as ConfigService;

  return new LlmExecutorService(provider, config);
}

export async function writeEvaluationReport(
  report: EvaluationReport,
  outDir: string,
  prefix: string,
): Promise<{ jsonPath: string; summaryPath: string; summary: string }> {
  await mkdir(outDir, { recursive: true });

  const jsonPath = path.join(outDir, `${prefix}-evaluation.json`);
  const summaryPath = path.join(outDir, `${prefix}-summary.md`);
  const summary = renderEvaluationSummary(report);

  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(summaryPath, summary, 'utf8');

  return { jsonPath, summaryPath, summary };
}
