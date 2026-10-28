import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { HealthService } from './health.service';
import { LivenessResponseDto, ReadinessResponseDto } from './dto/health.dto';

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Application liveness' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Application is running',
    type: LivenessResponseDto,
  })
  getHealth(): LivenessResponseDto {
    return this.healthService.getLiveness();
  }

  @Get('ready')
  @ApiOperation({ summary: 'Application readiness (including database connectivity)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'All required dependencies are available',
    type: ReadinessResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    description: 'A required dependency is unavailable',
    type: ReadinessResponseDto,
  })
  async getReadiness(@Res({ passthrough: true }) res: Response): Promise<ReadinessResponseDto> {
    const result = await this.healthService.getReadiness();

    if (result.status !== 'ok') {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return result;
  }
}
