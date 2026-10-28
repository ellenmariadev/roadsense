export const LLM_PROVIDER = Symbol('LLM_PROVIDER');

/**
 * The result of a single provider call. `output` is the raw (untrusted) model
 * output; it must be schema-validated before being treated as a suggestion.
 */
export interface LlmExtraction {
  output: unknown;
  provider: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
}

/**
 * A pluggable LLM provider. Implementations only *extract* structured data from
 * free text. They never execute tools, SQL, shell commands or privileged actions.
 */
export interface LlmProvider {
  readonly provider: string;
  readonly model: string;
  extract(sourceText: string): Promise<LlmExtraction>;
}

export class LlmProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmProviderError';
  }
}

export class LlmOutputValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmOutputValidationError';
  }
}
