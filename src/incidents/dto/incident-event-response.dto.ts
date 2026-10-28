import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IncidentEventType } from '@prisma/client';

export class IncidentEventResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: IncidentEventType })
  type: IncidentEventType;

  @ApiPropertyOptional()
  metadata: unknown;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  incidentId: string;

  @ApiPropertyOptional()
  actorId: string | null;
}
