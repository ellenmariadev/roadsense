import { IncidentType } from '@prisma/client';
import { LlmExtraction, LlmProvider } from './llm-provider.interface';

const ROAD_NAME_REGEX = /\b(BR|SP|MG|RJ|PR|SC|RS|BA|PE|CE|DF|GO|MT|MS|ES|AM|PA)-\d{2,3}\b/i;
const KILOMETER_REGEX = /\bkm\s*(\d{1,4}(?:[.,]\d)?)\b/i;
const DIRECTION_REGEX = /\bsentido\s+(norte|sul|leste|oeste)\b/i;

/**
 * Deterministic, offline LLM provider used for local development and automated
 * tests. No API credentials required. It performs simple keyword/pattern
 * extraction over the report text so the triage pipeline can run end to end
 * without a network or an external service.
 */
export class MockLlmProvider implements LlmProvider {
  readonly provider = 'mock';
  readonly model = 'mock-triage-v1';

  async extract(sourceText: string): Promise<LlmExtraction> {
    const lower = sourceText.toLowerCase();

    const incidentType = this.detectIncidentType(lower);
    const roadName = sourceText.match(ROAD_NAME_REGEX)?.[0]?.toUpperCase() ?? null;
    const kilometerMarker = sourceText.match(KILOMETER_REGEX)?.[1] ?? null;
    const direction = sourceText.match(DIRECTION_REGEX)?.[1]?.toLowerCase() ?? null;
    const riskFactors = this.detectRiskFactors(lower);
    const description = this.firstSentence(sourceText);

    const locationParts = [roadName, kilometerMarker ? `km ${kilometerMarker}` : null].filter(
      (part): part is string => Boolean(part),
    );
    const locationText = locationParts.join(', ') || null;

    const missingInformation: string[] = [];
    if (!roadName) missingInformation.push('roadName');
    if (!kilometerMarker) missingInformation.push('kilometerMarker');
    if (!direction) missingInformation.push('direction');

    const extractedCount = [roadName, kilometerMarker, direction].filter(Boolean).length;
    const confidence = this.confidence(extractedCount);

    return {
      output: {
        incidentType,
        description,
        locationText,
        roadName,
        kilometerMarker,
        direction,
        riskFactors,
        confidence,
        missingInformation,
        sourceText,
      },
      provider: this.provider,
      model: this.model,
      promptTokens: Math.ceil(sourceText.length / 4),
      completionTokens: 80,
    };
  }

  private detectIncidentType(lower: string): IncidentType {
    if (/(colis[ãa]o|acidente|batida|capotamento|atropelamento)/.test(lower)) {
      return IncidentType.ACCIDENT;
    }
    if (/(alagamento|inunda[çc][ãa]o|enchente|água na pista)/.test(lower)) {
      return IncidentType.FLOODING;
    }
    if (/(caminh[ãa]o|ônibus|carro|veículo).*(falha|quebr|pane|mec[âa]nic)/.test(lower)) {
      return IncidentType.VEHICLE_BREAKDOWN;
    }
    if (/(buraco|asfalto|pavimento|ponte|viaduto|sinaliza[çc][ãa]o|barreira)/.test(lower)) {
      return IncidentType.INFRASTRUCTURE_DAMAGE;
    }
    if (/(árvore|obst[áa]culo|objeto|pedra|entulho|queda de barreira)/.test(lower)) {
      return IncidentType.ROAD_OBSTRUCTION;
    }
    return IncidentType.OTHER;
  }

  private detectRiskFactors(lower: string): string[] {
    const factors: string[] = [];
    if (/(v[íi]tima|ferido|morte|fatal)/.test(lower)) factors.push('vítimas');
    if (/(bloqueio total|interditad|intransit[áa]vel)/.test(lower)) factors.push('bloqueio total');
    else if (/(bloqueio|bloquead|interdi[çc][ãa]o de faixa)/.test(lower))
      factors.push('bloqueio de faixa');
    if (/(vazamento|inc[êe]ndio|fogo|explos)/.test(lower)) factors.push('risco adicional');
    return factors;
  }

  private firstSentence(sourceText: string): string {
    const trimmed = sourceText.trim();
    const match = trimmed.match(/^[^.!?\n]+/);
    return match ? match[0].trim() : trimmed;
  }

  private confidence(extractedCount: number): number {
    if (extractedCount >= 3) return 0.9;
    if (extractedCount === 2) return 0.75;
    if (extractedCount === 1) return 0.6;
    return 0.4;
  }
}
