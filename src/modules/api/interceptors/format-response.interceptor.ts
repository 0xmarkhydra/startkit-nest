import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ResponseMessageKey } from '@/shared/decorators/response-message.decorator';
import { SKIP_RESPONSE_FORMAT_KEY } from '@/shared/decorators/skip-response-format.decorator';
import { PaginationResponse } from '@/shared/pagination/pagination.interface';
import { BaseResponse } from '@/shared/swagger/response/base.response';

const PAGINATION_KEYS = ['total', 'current_page', 'total_pages', 'take'] as const;

type PaginatedPayload = {
  data: unknown;
  pagination: PaginationResponse;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isPaginationResponse = (value: unknown): value is PaginationResponse => {
  if (!isRecord(value)) {
    return false;
  }

  const hasKnownKey = PAGINATION_KEYS.some((key) => key in value);
  if (!hasKnownKey) {
    return false;
  }

  return PAGINATION_KEYS.every((key) => {
    const field = value[key];
    return field === undefined || typeof field === 'number';
  });
};

const isPaginatedPayload = (value: unknown): value is PaginatedPayload =>
  isRecord(value) &&
  'data' in value &&
  isPaginationResponse(value.pagination);

@Injectable()
export class FormatResponseInterceptor
  implements NestInterceptor<unknown, unknown>
{
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<unknown>,
  ): Observable<unknown> {
    const skipFormatting = this.reflector.getAllAndOverride<boolean>(
      SKIP_RESPONSE_FORMAT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (skipFormatting) {
      return next.handle();
    }

    const responseMessage =
      this.reflector.get<string>(ResponseMessageKey, context.getHandler()) ?? '';

    return next.handle().pipe(
      map((data: unknown) => {
        const statusCode = context
          .switchToHttp()
          .getResponse<{ statusCode: number }>().statusCode;

        if (isPaginatedPayload(data)) {
          return new BaseResponse(
            data.data,
            statusCode,
            responseMessage,
            data.pagination,
          );
        }

        return new BaseResponse(data, statusCode, responseMessage);
      }),
    );
  }
}
