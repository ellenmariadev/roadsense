import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TimeoutError, withTimeout } from '../common/utils/with-timeout';
import {
  LLM_PROVIDER,
  LlmExtraction,
  LlmProvider,
  LlmProviderError,
} from './llm-provider.interface';

export interface LlmExecutionResult {
  extraction: LlmExtraction;
  latencyMs: number;
  attempts: number;
}

/**
 * Executes a provider call with a bounded timeout and bounded retries. Retries
 * only happen on provider-level failures/timeouts (never on schema validation,
 * which is the caller's responsibility) and produce a single logical result, so
 * no duplicate incidents or audit records are created.
 */
@Injectable()
export class LlmExecutorService {
  private readonly logger = new Logger(LlmExecutorService.name);

  constructor(
    @Inject(LLM_PROVIDER) private readonly provider: LlmProvider,
    private readonly configService: ConfigService,
  ) {}

  async execute(sourceText: string): Promise<LlmExecutionResult> {
    const timeoutMs = this.configService.get<number>('llm.timeoutMs', 10000);
    const maxRetries = this.configService.get<number>('llm.maxRetries', 2);

    const startedAt = Date.now();
    let lastError: Error = new LlmProviderError('LLM provider failed');

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const extraction = await withTimeout(this.provider.extract(sourceText), timeoutMs);
        return {
          extraction,
          latencyMs: Date.now() - startedAt,
          attempts: attempt + 1,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new LlmProviderError('LLM provider failed');

        if (attempt < maxRetries) {
          this.logger.warn(
            `LLM attempt ${attempt + 1} failed (${this.describe(lastError)}), retrying`,
          );
          await this.sleep(100 * (attempt + 1));
        }
      }
    }

    this.logger.warn(`LLM execution failed after ${maxRetries + 1} attempts`);
    throw lastError;
  }

  private describe(error: Error): string {
    if (error instanceof TimeoutError) return 'timeout';
    return error.name;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
