import path from 'node:path';
import { LlmProvider } from '../src/ai/llm-provider.interface';
import { MockLlmProvider } from '../src/ai/mock-llm.provider';
import { OpenAiLlmProvider } from '../src/ai/openai-llm.provider';
import { EVALUATION_CASES } from '../src/evaluation/evaluation-dataset';
import { evaluateDataset } from '../src/evaluation/evaluation-runner';
import {
  createExecutor,
  DEFAULT_OUT_DIR,
  parseNonNegativeInteger,
  takeValue,
  writeEvaluationReport,
} from './evaluation-cli';

type ProviderName = 'mock' | 'openai';

interface CliOptions {
  provider: ProviderName;
  allowReal: boolean;
  outDir: string;
  timeoutMs: number;
  maxRetries: number;
  help: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    provider: 'mock',
    allowReal: false,
    outDir: DEFAULT_OUT_DIR,
    timeoutMs: Number(process.env.LLM_TIMEOUT_MS ?? 10000),
    maxRetries: Number(process.env.LLM_MAX_RETRIES ?? 2),
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--help' || argument === '-h') {
      options.help = true;
      continue;
    }
    if (argument === '--allow-real') {
      options.allowReal = true;
      continue;
    }
    if (argument === '--provider') {
      const value = takeValue(argv, index, '--provider');
      if (value !== 'mock' && value !== 'openai') {
        throw new Error('--provider must be "mock" or "openai"');
      }
      options.provider = value;
      index += 1;
      continue;
    }
    if (argument.startsWith('--provider=')) {
      const value = argument.slice('--provider='.length);
      if (value !== 'mock' && value !== 'openai') {
        throw new Error('--provider must be "mock" or "openai"');
      }
      options.provider = value;
      continue;
    }
    if (argument === '--out-dir') {
      options.outDir = path.resolve(takeValue(argv, index, '--out-dir'));
      index += 1;
      continue;
    }
    if (argument.startsWith('--out-dir=')) {
      options.outDir = path.resolve(argument.slice('--out-dir='.length));
      continue;
    }
    if (argument === '--timeout-ms') {
      options.timeoutMs = parseNonNegativeInteger(
        takeValue(argv, index, '--timeout-ms'),
        '--timeout-ms',
      );
      index += 1;
      continue;
    }
    if (argument.startsWith('--timeout-ms=')) {
      options.timeoutMs = parseNonNegativeInteger(
        argument.slice('--timeout-ms='.length),
        '--timeout-ms',
      );
      continue;
    }
    if (argument === '--max-retries') {
      options.maxRetries = parseNonNegativeInteger(
        takeValue(argv, index, '--max-retries'),
        '--max-retries',
      );
      index += 1;
      continue;
    }
    if (argument.startsWith('--max-retries=')) {
      options.maxRetries = parseNonNegativeInteger(
        argument.slice('--max-retries='.length),
        '--max-retries',
      );
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return options;
}

function printHelp(): void {
  process.stdout.write(
    [
      'Usage: npm run eval -- [options]',
      '',
      'Runs the fictional Road Sense AI evaluation dataset.',
      '',
      'Options:',
      '  --provider mock|openai   Provider to evaluate (default: mock).',
      '  --allow-real             Required when --provider=openai. Makes network calls.',
      '  --out-dir <path>         Report directory (default: evaluation/reports).',
      '  --timeout-ms <number>    Per-attempt timeout (default: LLM_TIMEOUT_MS or 10000).',
      '  --max-retries <number>   Retry count (default: LLM_MAX_RETRIES or 2).',
      '  --help                   Show this help.',
      '',
      'Real evaluation also requires OPENAI_API_KEY. Optional: OPENAI_MODEL, OPENAI_BASE_URL.',
      'The mock provider is offline and deterministic; use it for CI.',
      'For an opt-in real run, npm run eval:real -- --allow-real is the dedicated runner.',
      '',
    ].join('\n'),
  );
}

function createProvider(options: CliOptions): LlmProvider {
  if (options.provider === 'mock') {
    return new MockLlmProvider();
  }

  if (!options.allowReal) {
    throw new Error(
      'Real LLM evaluation is opt-in. Re-run with --provider openai --allow-real and OPENAI_API_KEY set.',
    );
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required for --provider openai');
  }

  return new OpenAiLlmProvider({
    apiKey,
    model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
    baseUrl: process.env.OPENAI_BASE_URL,
  });
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  const provider = createProvider(options);
  const executor = createExecutor(provider, options.timeoutMs, options.maxRetries);
  const report = await evaluateDataset(
    EVALUATION_CASES,
    (sourceText) => executor.execute(sourceText),
    {
      mode: options.provider === 'openai' ? 'real' : 'mock',
      provider: provider.provider,
      model: provider.model,
    },
  );

  const { jsonPath, summaryPath, summary } = await writeEvaluationReport(
    report,
    options.outDir,
    options.provider,
  );

  process.stdout.write(`Wrote ${jsonPath}\nWrote ${summaryPath}\n\n`);
  process.stdout.write(summary);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown evaluation error';
  process.stderr.write(`Evaluation failed: ${message}\n`);
  process.exitCode = 1;
});
