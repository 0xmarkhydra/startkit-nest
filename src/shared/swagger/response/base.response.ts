import { HttpStatus } from '@nestjs/common';
import { PaginationResponse } from '@/shared/pagination/pagination.interface';

export class BaseResponse<T> {
  readonly data: T;
  readonly msg: string;
  readonly status_code: number;
  readonly timestamp: string;
  readonly pagination?: PaginationResponse;

  constructor(
    data: T,
    statusCode: number = HttpStatus.OK,
    message = '',
    pagination?: PaginationResponse,
  ) {
    this.data = data;
    this.msg = message;
    this.status_code = statusCode;
    this.timestamp = new Date().toISOString();
    this.pagination = pagination;
  }
}
