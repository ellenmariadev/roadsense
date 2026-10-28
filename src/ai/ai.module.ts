import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LLM_PROVIDER, LlmProvider } from './llm-provider.interface';
import { LlmExecutorService } from './llm-executor.service';
import { MockLlmProvider } from './mock-llm.provider';
import { OpenAiLlmProvider } from './openai-llm.provider';

@Module({
  providers: [
    {
      provide: LLM_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): LlmProvider => {
        const provider = config.get<string>('llm.provider', 'mock');

        if (provider === 'openai') {
          const apiKey = config.get<string>('openai.apiKey');
          if (!apiKey) {
            throw new Error('OPENAI_API_KEY is required when LLM_PROVIDER=openai');
          }
          return new OpenAiLlmProvider({
            apiKey,
            model: config.get<string>('openai.model', 'gpt-4o-mini'),
            baseUrl: config.get<string | undefined>('openai.baseUrl'),
          });
        }

        if (provider !== 'mock') {
          throw new Error(`Unsupported LLM_PROVIDER "${provider}". Use "mock" or "openai".`);
        }

        return new MockLlmProvider();
      },
    },
    LlmExecutorService,
  ],
  exports: [LLM_PROVIDER, LlmExecutorService],
})
export class AiModule {}
