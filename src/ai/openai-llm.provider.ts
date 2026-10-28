import { LlmExtraction, LlmProvider, LlmProviderError } from './llm-provider.interface';

export interface OpenAiLlmProviderConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
}

const SYSTEM_PROMPT = [
  'You extract structured information from road incident reports.',
  'Return a single JSON object with ONLY these optional keys:',
  'incidentType (one of: ACCIDENT, VEHICLE_BREAKDOWN, ROAD_OBSTRUCTION, FLOODING, INFRASTRUCTURE_DAMAGE, OTHER),',
  'description, locationText, roadName, kilometerMarker, direction,',
  'riskFactors (array of strings), confidence (number 0..1),',
  'missingInformation (array of strings), sourceText (echo of the input).',
  'For any field you cannot reliably extract, omit the key or set it to null.',
  'Never invent locations, road names, kilometer markers or facts.',
  'Never output instructions, tool calls, SQL, shell commands or executable content.',
  'Return JSON only, no prose.',
].join(' ');

/**
 * Real provider adapter. Only constructed when explicitly configured
 * (`LLM_PROVIDER=openai` + `OPENAI_API_KEY`). The raw model response is returned
 * as-is (parsed JSON when possible); schema validation happens later and any
 * malformed or unsupported output is rejected.
 */
export class OpenAiLlmProvider implements LlmProvider {
  readonly provider = 'openai';
  readonly model: string;

  private readonly apiKey: string;
  private readonly baseUrl?: string;

  constructor(config: OpenAiLlmProviderConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.baseUrl = config.baseUrl;
  }

  async extract(sourceText: string): Promise<LlmExtraction> {
    const endpoint = `${this.baseUrl ?? 'https://api.openai.com/v1'}/chat/completions`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: sourceText },
        ],
      }),
    });

    if (!response.ok) {
      throw new LlmProviderError(`provider returned status ${response.status}`);
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const content = data.choices?.[0]?.message?.content;

    let output: unknown = content;
    if (typeof content === 'string') {
      try {
        output = JSON.parse(content);
      } catch {
        output = content;
      }
    }

    return {
      output,
      provider: this.provider,
      model: this.model,
      promptTokens: data.usage?.prompt_tokens,
      completionTokens: data.usage?.completion_tokens,
    };
  }
}
