import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { plainToInstance } from 'class-transformer';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { PaginationResponse } from '@/shared/pagination/pagination.interface';
import { ResponseMessageKey } from '@/shared/decorators/response-message.decorator';
import { SKIP_RESPONSE_FORMAT_KEY } from '@/shared/decorators/skip-response-format.decorator';
import { BaseResponse } from '@/shared/swagger/response/base.response';

@Injectable()
export class FormatResponseInterceptor<T>
  implements NestInterceptor<T, T | BaseResponse<T>>
{
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<T | BaseResponse<T>> {
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
      map((data: any) => {
        const statusCode = context
          .switchToHttp()
          .getResponse<{ statusCode: number }>().statusCode;
        const pagination = plainToInstance(
          PaginationResponse,
          data?.pagination,
          { strategy: 'excludeAll' },
        );

        if (data?.pagination && Object.keys(pagination).length > 0) {
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
