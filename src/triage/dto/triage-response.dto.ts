import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IncidentType, TriageStatus } from '@prisma/client';

export class TriageRunResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  sourceText: string;

  @ApiProperty({ enum: TriageStatus })
  status: TriageStatus;

  @ApiPropertyOptional()
  provider: string | null;

  @ApiPropertyOptional()
  model: string | null;

  @ApiPropertyOptional()
  latencyMs: number | null;

  @ApiPropertyOptional()
  promptTokens: number | null;

  @ApiPropertyOptional()
  completionTokens: number | null;

  @ApiPropertyOptional()
  errorMessage: string | null;

  @ApiPropertyOptional({ enum: IncidentType })
  suggestedIncidentType: IncidentType | null;

  @ApiPropertyOptional()
  suggestedDescription: string | null;

  @ApiPropertyOptional()
  suggestedLocationText: string | null;

  @ApiPropertyOptional()
  suggestedRoadName: string | null;

  @ApiPropertyOptional()
  suggestedKilometerMarker: string | null;

  @ApiPropertyOptional()
  suggestedDirection: string | null;

  @ApiProperty({ type: [String] })
  riskFactors: string[];

  @ApiPropertyOptional()
  confidence: number | null;

  @ApiProperty({ type: [String] })
  missingInformation: string[];

  @ApiPropertyOptional()
  idempotencyKey: string | null;

  @ApiProperty()
  requestedAt: Date;

  @ApiPropertyOptional()
  completedAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional()
  incidentId: string | null;
}
