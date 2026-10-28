import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IncidentStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class TransitionIncidentDto {
  @ApiProperty({ enum: IncidentStatus })
  @IsEnum(IncidentStatus)
  to: IncidentStatus;

  @ApiPropertyOptional({ description: 'Optional human-readable transition reason' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
