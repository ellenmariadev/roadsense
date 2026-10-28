import { Inject, Injectable } from '@nestjs/common';
import { LlmExecutorService } from '../ai/llm-executor.service';
import { LLM_PROVIDER, LlmProvider } from '../ai/llm-provider.interface';
import { EVALUATION_CASES } from './evaluation-dataset';
import { evaluateDataset } from './evaluation-runner';
import { EvaluationCase, EvaluationReport } from './evaluation.types';

@Injectable()
export class EvaluationService {
  constructor(
    private readonly executor: LlmExecutorService,
    @Inject(LLM_PROVIDER) private readonly provider: LlmProvider,
  ) {}

  run(cases: readonly EvaluationCase[] = EVALUATION_CASES): Promise<EvaluationReport> {
    return evaluateDataset(cases, (sourceText) => this.executor.execute(sourceText), {
      mode: this.provider.provider === 'mock' ? 'mock' : 'runtime',
      provider: this.provider.provider,
      model: this.provider.model,
    });
  }
}
