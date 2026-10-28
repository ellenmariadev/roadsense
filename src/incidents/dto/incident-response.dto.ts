import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IncidentStatus, IncidentType, Priority } from '@prisma/client';

export class IncidentResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  originalReport: string;

  @ApiPropertyOptional({ enum: IncidentType })
  incidentType: IncidentType | null;

  @ApiPropertyOptional()
  description: string | null;

  @ApiPropertyOptional()
  locationText: string | null;

  @ApiPropertyOptional()
  roadName: string | null;

  @ApiPropertyOptional()
  kilometerMarker: string | null;

  @ApiPropertyOptional()
  direction: string | null;

  @ApiProperty({ enum: Priority })
  priority: Priority;

  @ApiProperty({ type: [String] })
  riskFactors: string[];

  @ApiProperty({ enum: IncidentStatus })
  status: IncidentStatus;

  @ApiProperty()
  reportedAt: Date;

  @ApiPropertyOptional()
  resolvedAt: Date | null;

  @ApiPropertyOptional()
  cancelledAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional()
  createdById: string | null;
}
