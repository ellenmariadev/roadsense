import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LivenessResponseDto, ReadinessResponseDto } from './dto/health.dto';

const DATABASE_CHECK_TIMEOUT_MS = 3000;

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  getLiveness(): LivenessResponseDto {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  async getReadiness(): Promise<ReadinessResponseDto> {
    const databaseUp = await this.isDatabaseHealthy();

    return {
      status: databaseUp ? 'ok' : 'error',
      checks: {
        database: databaseUp ? 'up' : 'down',
      },
    };
  }

  private async isDatabaseHealthy(): Promise<boolean> {
    try {
      await this.withTimeout(this.prisma.$queryRaw`SELECT 1`, DATABASE_CHECK_TIMEOUT_MS);
      return true;
    } catch (error) {
      this.logger.warn(`Database readiness check failed: ${(error as Error).message}`);
      return false;
    }
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Operation timed out after ${timeoutMs}ms`)),
        timeoutMs,
      );

      promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error) => {
          clearTimeout(timer);
          reject(error);
        },
      );
    });
  }
}
