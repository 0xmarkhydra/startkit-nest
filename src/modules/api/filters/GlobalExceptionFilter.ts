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

interface ErrorResponse {
  statusCode: number;
  message: string | string[];
  error?: string;
  errorId?: string;
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
    const normalized = this.normalizeException(exception, status);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const errorId = randomUUID();
      this.logger.error(
        `${request.method || 'HTTP'} ${request.url || 'unknown'} failed [${errorId}]`,
        exception instanceof Error ? exception.stack : String(exception),
      );

      response.status(status).send({
        statusCode: status,
        message: this.exposeInternalErrors
          ? normalized.message
          : 'Internal server error',
        ...(normalized.error ? { error: normalized.error } : {}),
        errorId,
      } satisfies ErrorResponse);
      return;
    }

    if (this.logAllErrors) {
      this.logger.warn(
        `${request.method || 'HTTP'} ${request.url || 'unknown'} returned ${status}: ${JSON.stringify(normalized.message)}`,
      );
    }

    response.status(status).send(normalized);
  }

  private normalizeException(
    exception: unknown,
    status: number,
  ): ErrorResponse {
    if (!(exception instanceof HttpException)) {
      return {
        statusCode: status,
        message: exception instanceof Error ? exception.message : 'Unknown error',
      };
    }

    const exceptionResponse = exception.getResponse();
    if (typeof exceptionResponse === 'string') {
      return {
        statusCode: status,
        message: exceptionResponse,
      };
    }

    const payload = exceptionResponse as Record<string, unknown>;
    return {
      statusCode: status,
      message:
        typeof payload.message === 'string' || Array.isArray(payload.message)
          ? (payload.message as string | string[])
          : exception.message,
      ...(typeof payload.error === 'string' ? { error: payload.error } : {}),
    };
  }
}
