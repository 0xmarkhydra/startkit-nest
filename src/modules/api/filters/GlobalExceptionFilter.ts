import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';

interface HttpRequestLike {
  method?: string;
  url?: string;
}

interface HttpReplyLike {
  status(code: number): HttpReplyLike;
  send(payload: unknown): unknown;
}

interface NormalizedException {
  message: string | string[];
  error?: string;
}

interface ErrorResponse {
  status_code: number;
  message: string | string[];
  timestamp: string;
  error?: string;
  error_id?: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(
    private readonly exposeInternalErrors = false,
    private readonly logAllErrors = false,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<HttpReplyLike>();
    const request = context.getRequest<HttpRequestLike>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const normalized = this.normalizeException(exception);
    const timestamp = new Date().toISOString();

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const errorId = randomUUID();
      if (!this.shouldSuppressErrorLog(exception)) {
        this.logger.error(
          `${request.method || 'HTTP'} ${request.url || 'unknown'} failed [${errorId}]`,
          exception instanceof Error ? exception.stack : String(exception),
        );
      }

      response.status(status).send({
        status_code: status,
        message: this.exposeInternalErrors
          ? normalized.message
          : 'Internal server error',
        ...(this.exposeInternalErrors && normalized.error
          ? { error: normalized.error }
          : {}),
        error_id: errorId,
        timestamp,
      } satisfies ErrorResponse);
      return;
    }

    if (this.logAllErrors) {
      this.logger.warn(
        `${request.method || 'HTTP'} ${request.url || 'unknown'} returned ${status}: ${JSON.stringify(normalized.message)}`,
      );
    }

    response.status(status).send({
      status_code: status,
      message: normalized.message,
      ...(normalized.error ? { error: normalized.error } : {}),
      timestamp,
    } satisfies ErrorResponse);
  }

  private shouldSuppressErrorLog(exception: unknown): boolean {
    if (!(exception instanceof HttpException)) {
      return false;
    }

    const exceptionResponse = exception.getResponse();
    if (
      typeof exceptionResponse !== 'object' ||
      exceptionResponse === null ||
      Array.isArray(exceptionResponse)
    ) {
      return false;
    }

    return (
      (exceptionResponse as Record<string, unknown>).suppressErrorLog === true
    );
  }

  private normalizeException(exception: unknown): NormalizedException {
    if (!(exception instanceof HttpException)) {
      return {
        message: exception instanceof Error ? exception.message : 'Unknown error',
      };
    }

    const exceptionResponse = exception.getResponse();
    if (typeof exceptionResponse === 'string') {
      return { message: exceptionResponse };
    }

    if (
      typeof exceptionResponse !== 'object' ||
      exceptionResponse === null ||
      Array.isArray(exceptionResponse)
    ) {
      return { message: exception.message };
    }

    const payload = exceptionResponse as Record<string, unknown>;
    return {
      message:
        typeof payload.message === 'string' || Array.isArray(payload.message)
          ? (payload.message as string | string[])
          : exception.message,
      ...(typeof payload.error === 'string' ? { error: payload.error } : {}),
    };
  }
}
