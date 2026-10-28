import path from 'node:path';
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

interface RealCliOptions {
  allowReal: boolean;
  outDir: string;
  timeoutMs: number;
  maxRetries: number;
  model: string;
  help: boolean;
}

function parseArgs(argv: string[]): RealCliOptions {
  const options: RealCliOptions = {
    allowReal: false,
    outDir: DEFAULT_OUT_DIR,
    timeoutMs: Number(process.env.LLM_TIMEOUT_MS ?? 10000),
    maxRetries: Number(process.env.LLM_MAX_RETRIES ?? 2),
    model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
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
    if (argument === '--model') {
      options.model = takeValue(argv, index, '--model');
      index += 1;
      continue;
    }
    if (argument.startsWith('--model=')) {
      options.model = argument.slice('--model='.length);
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return options;
}

function printHelp(): void {
  process.stdout.write(
    [
      'Usage: npm run eval:real -- --allow-real [options]',
      '',
      'Runs the Road Sense evaluation against a real OpenAI-compatible provider.',
      'This makes network calls and may incur provider costs.',
      '',
      'Required:',
      '  --allow-real             Explicit acknowledgement of the real model call.',
      '  OPENAI_API_KEY           Provider credential in the environment.',
      '',
      'Options:',
      '  --model <name>           Model id (default: OPENAI_MODEL or gpt-4o-mini).',
      '  --out-dir <path>         Report directory (default: evaluation/reports).',
      '  --timeout-ms <number>    Per-attempt timeout (default: LLM_TIMEOUT_MS or 10000).',
      '  --max-retries <number>   Retry count (default: LLM_MAX_RETRIES or 2).',
      '  --help                   Show this help.',
      '',
      'Optional: OPENAI_BASE_URL for an OpenAI-compatible endpoint.',
      '',
    ].join('\n'),
  );
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  if (!options.allowReal) {
    throw new Error(
      'Real LLM evaluation is opt-in. Re-run with --allow-real and OPENAI_API_KEY set.',
    );
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required for the real evaluation runner');
  }

  const provider = new OpenAiLlmProvider({
    apiKey,
    model: options.model,
    baseUrl: process.env.OPENAI_BASE_URL,
  });
  const executor = createExecutor(provider, options.timeoutMs, options.maxRetries);
  const report = await evaluateDataset(
    EVALUATION_CASES,
    (sourceText) => executor.execute(sourceText),
    {
      mode: 'real',
      provider: provider.provider,
      model: provider.model,
    },
  );

  const { jsonPath, summaryPath, summary } = await writeEvaluationReport(
    report,
    options.outDir,
    'openai',
  );

  process.stdout.write(`Wrote ${jsonPath}\nWrote ${summaryPath}\n\n`);
  process.stdout.write(summary);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown real evaluation error';
  process.stderr.write(`Real evaluation failed: ${message}\n`);
  process.exitCode = 1;
});
