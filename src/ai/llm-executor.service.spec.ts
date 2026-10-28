import { ConfigService } from '@nestjs/config';
import { TimeoutError } from '../common/utils/with-timeout';
import { LlmExecutorService } from './llm-executor.service';
import { LlmExtraction, LlmProvider, LlmProviderError } from './llm-provider.interface';

function makeExtraction(): LlmExtraction {
  return { output: { incidentType: 'ACCIDENT' }, provider: 'fake', model: 'fake-v1' };
}

function makeConfig(timeoutMs: number, maxRetries: number): ConfigService {
  return {
    get: jest.fn((key: string, def?: unknown) => {
      if (key === 'llm.timeoutMs') return timeoutMs;
      if (key === 'llm.maxRetries') return maxRetries;
      return def;
    }),
  } as unknown as ConfigService;
}

describe('LlmExecutorService', () => {
  it('returns the extraction with latency and attempts on success', async () => {
    const provider: LlmProvider = {
      provider: 'fake',
      model: 'fake-v1',
      extract: jest.fn().mockResolvedValue(makeExtraction()),
    };
    const executor = new LlmExecutorService(provider, makeConfig(1000, 2));

    const result = await executor.execute('relato');

    expect(result.extraction.provider).toBe('fake');
    expect(result.attempts).toBe(1);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('retries and succeeds after a transient failure', async () => {
    const extract = jest
      .fn()
      .mockRejectedValueOnce(new LlmProviderError('boom'))
      .mockResolvedValueOnce(makeExtraction());
    const provider: LlmProvider = { provider: 'fake', model: 'fake-v1', extract };
    const executor = new LlmExecutorService(provider, makeConfig(1000, 1));

    const result = await executor.execute('relato');

    expect(extract).toHaveBeenCalledTimes(2);
    expect(result.attempts).toBe(2);
  });

  it('throws after exhausting bounded retries', async () => {
    const extract = jest.fn().mockRejectedValue(new LlmProviderError('down'));
    const provider: LlmProvider = { provider: 'fake', model: 'fake-v1', extract };
    const executor = new LlmExecutorService(provider, makeConfig(1000, 1));

    await expect(executor.execute('relato')).rejects.toThrow(LlmProviderError);
    expect(extract).toHaveBeenCalledTimes(2);
  });

  it('throws a TimeoutError when the provider exceeds the bounded timeout', async () => {
    const extract = jest
      .fn()
      .mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(makeExtraction()), 150)),
      );
    const provider: LlmProvider = { provider: 'fake', model: 'fake-v1', extract };
    const executor = new LlmExecutorService(provider, makeConfig(20, 0));

    await expect(executor.execute('relato')).rejects.toThrow(TimeoutError);
  });
});
