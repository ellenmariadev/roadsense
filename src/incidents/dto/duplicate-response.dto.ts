import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DuplicateStatus } from '@prisma/client';
import { IncidentResponseDto } from './incident-response.dto';

export class DuplicateSignalDto {
  @ApiProperty({ description: 'Signal value (string enum or numeric similarity)' })
  value: string | number;

  @ApiProperty({ description: 'Human-readable explanation of the signal' })
  reason: string;
}

export class DuplicateSignalsDto {
  @ApiProperty({ type: DuplicateSignalDto })
  road: DuplicateSignalDto;

  @ApiProperty({ type: DuplicateSignalDto })
  kilometer: DuplicateSignalDto;

  @ApiProperty({ type: DuplicateSignalDto })
  incidentType: DuplicateSignalDto;

  @ApiProperty({ type: DuplicateSignalDto })
  description: DuplicateSignalDto;

  @ApiProperty({ type: DuplicateSignalDto })
  time: DuplicateSignalDto;
}

export class DuplicateCandidateDto {
  @ApiProperty({ type: IncidentResponseDto, description: 'The candidate incident' })
  incident: IncidentResponseDto;

  @ApiProperty({ description: 'Deterministic similarity score (0..1)' })
  score: number;

  @ApiProperty({ type: DuplicateSignalsDto, description: 'Explainable matching signals' })
  signals: DuplicateSignalsDto;
}

export class ResolvedDuplicateDto {
  @ApiProperty({ description: 'Duplicate record id' })
  id: string;

  @ApiProperty({ enum: DuplicateStatus })
  status: DuplicateStatus;

  @ApiProperty({ type: IncidentResponseDto, description: 'The related incident' })
  incident: IncidentResponseDto;

  @ApiProperty()
  score: number;

  @ApiProperty({ type: DuplicateSignalsDto })
  signals: DuplicateSignalsDto;

  @ApiProperty()
  confirmedAt: Date;

  @ApiPropertyOptional()
  confirmedById: string | null;
}

export class DuplicateCandidatesResponseDto {
  @ApiProperty()
  incidentId: string;

  @ApiProperty({
    type: [DuplicateCandidateDto],
    description: 'Detected candidate matches (NOT confirmed — never auto-merged/acted on)',
  })
  candidates: DuplicateCandidateDto[];

  @ApiProperty({ type: [ResolvedDuplicateDto], description: 'Human-confirmed duplicates' })
  confirmed: ResolvedDuplicateDto[];

  @ApiProperty({ type: [ResolvedDuplicateDto], description: 'Human-rejected candidates' })
  rejected: ResolvedDuplicateDto[];
}
