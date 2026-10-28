export interface AppConfig {
  app: {
    port: number;
    globalPrefix: string;
  };
  jwt: {
    secret: string;
    expiresIn: string;
  };
  rateLimit: {
    max: number;
    windowMs: number;
  };
  llm: {
    provider: string;
    timeoutMs: number;
    maxRetries: number;
  };
  openai: {
    apiKey?: string;
    model: string;
    baseUrl?: string;
  };
}

export default (): AppConfig => ({
  app: {
    port: parseInt(process.env.APP_PORT ?? '3000', 10),
    globalPrefix: 'api/v1',
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? '',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
  },
  rateLimit: {
    max: parseInt(process.env.RATE_LIMIT_MAX ?? '300', 10),
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10),
  },
  llm: {
    provider: process.env.LLM_PROVIDER ?? 'mock',
    timeoutMs: parseInt(process.env.LLM_TIMEOUT_MS ?? '10000', 10),
    maxRetries: parseInt(process.env.LLM_MAX_RETRIES ?? '2', 10),
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
    baseUrl: process.env.OPENAI_BASE_URL,
  },
});
