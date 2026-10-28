import { IncidentType } from '@prisma/client';
import { MockLlmProvider } from './mock-llm.provider';

interface MockOutput {
  incidentType: IncidentType;
  roadName: string | null;
  kilometerMarker: string | null;
  direction: string | null;
  confidence: number;
  missingInformation: string[];
}

describe('MockLlmProvider', () => {
  const provider = new MockLlmProvider();

  it('identifies an accident and extracts road/km/direction', async () => {
    const result = await provider.extract(
      'Colisão entre dois veículos na BR-116, km 245, sentido sul. Duas faixas bloqueadas, há vítimas.',
    );
    const output = result.output as MockOutput;

    expect(result.provider).toBe('mock');
    expect(result.model).toBe('mock-triage-v1');
    expect(output).toMatchObject({
      incidentType: IncidentType.ACCIDENT,
      roadName: 'BR-116',
      kilometerMarker: '245',
      direction: 'sul',
    });
    expect(output.confidence).toBeGreaterThan(0.5);
  });

  it('marks absent fields as missing information', async () => {
    const result = await provider.extract('Algo estranho na pista, não consegui identificar.');
    const output = result.output as MockOutput;

    expect(output.incidentType).toBe(IncidentType.OTHER);
    expect(output.roadName).toBeNull();
    expect(output.missingInformation).toEqual(
      expect.arrayContaining(['roadName', 'kilometerMarker', 'direction']),
    );
  });

  it('is deterministic for the same input', async () => {
    const input = 'Alagamento severo na altura do km 12 da rodovia, pista totalmente coberta.';
    const first = await provider.extract(input);
    const second = await provider.extract(input);

    expect(first.output).toEqual(second.output);
  });
});
