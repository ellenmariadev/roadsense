import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateTriageDto {
  @ApiProperty({ description: 'Free-text incident report to extract structured data from' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  sourceText: string;

  @ApiPropertyOptional({
    description: 'Incident to associate this triage run with (optional)',
  })
  @IsOptional()
  @IsUUID()
  incidentId?: string;

  @ApiPropertyOptional({
    description: 'Idempotency key to prevent duplicate triage runs on retry',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotencyKey?: string;
}
