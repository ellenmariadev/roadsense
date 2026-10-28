import { ApiProperty } from '@nestjs/swagger';

export class LivenessResponseDto {
  @ApiProperty({ example: 'ok', enum: ['ok'] })
  status: string;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  timestamp: string;

  @ApiProperty({ example: 42.5, description: 'Process uptime in seconds' })
  uptime: number;
}

export class ReadinessCheckDto {
  @ApiProperty({ example: 'up', enum: ['up', 'down'] })
  database: string;
}

export class ReadinessResponseDto {
  @ApiProperty({ example: 'ok', enum: ['ok', 'error'] })
  status: string;

  @ApiProperty({ type: ReadinessCheckDto })
  checks: ReadinessCheckDto;
}
