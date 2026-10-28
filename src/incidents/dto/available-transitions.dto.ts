import { ApiProperty } from '@nestjs/swagger';
import { IncidentStatus } from '@prisma/client';

export class AvailableTransitionsDto {
  @ApiProperty({ enum: IncidentStatus })
  current: IncidentStatus;

  @ApiProperty({ enum: IncidentStatus, isArray: true })
  allowed: IncidentStatus[];
}
