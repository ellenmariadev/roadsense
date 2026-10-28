import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

interface ErrorResponseBody {
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
  path: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = resolveStatus(exception);

    const body: ErrorResponseBody = this.buildBody(exception, status, request.url);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} failed with status ${status}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json(body);
  }

  private buildBody(exception: unknown, status: number, path: string): ErrorResponseBody {
    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      const message =
        typeof res === 'string' ? res : (res as { message?: string | string[] }).message;
      const error =
        typeof res === 'object' && res !== null
          ? ((res as { error?: string }).error ?? exception.name)
          : exception.name;

      return {
        statusCode: status,
        message: message ?? exception.message,
        error,
        timestamp: new Date().toISOString(),
        path,
      };
    }

    if (status === HttpStatus.PAYLOAD_TOO_LARGE) {
      return {
        statusCode: status,
        message: 'Payload too large',
        error: 'Payload Too Large',
        timestamp: new Date().toISOString(),
        path,
      };
    }

    if (status < HttpStatus.INTERNAL_SERVER_ERROR) {
      return {
        statusCode: status,
        message: 'Invalid request',
        error: 'Bad Request',
        timestamp: new Date().toISOString(),
        path,
      };
    }

    return {
      statusCode: status,
      message: 'Internal server error',
      error: 'Internal Server Error',
      timestamp: new Date().toISOString(),
      path,
    };
  }
}

function resolveStatus(exception: unknown): number {
  if (exception instanceof HttpException) {
    return exception.getStatus();
  }

  const candidate =
    typeof exception === 'object' && exception !== null
      ? ((exception as { status?: unknown; statusCode?: unknown }).status ??
        (exception as { statusCode?: unknown }).statusCode)
      : undefined;

  if (typeof candidate === 'number' && candidate >= 400 && candidate <= 599) {
    return candidate;
  }

  return HttpStatus.INTERNAL_SERVER_ERROR;
}
