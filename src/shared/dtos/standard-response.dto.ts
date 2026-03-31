import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationDto {
  @ApiProperty({
    description: 'Current page number',
    example: 1
  })
  page: number;

  @ApiProperty({
    description: 'Items per page',
    example: 10
  })
  limit: number;

  @ApiProperty({
    description: 'Total number of items',
    example: 100
  })
  totalItems: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 10
  })
  totalPages: number;
}

export class StandardResponseDto<T> {
  @ApiProperty({
    description: 'HTTP status code',
    example: 200
  })
  statusCode: number;

  @ApiProperty({
    description: 'Response message',
    example: 'Operation successful'
  })
  message: string;

  @ApiProperty({
    description: 'Response data',
    // Khó xác định type generic trong swagger nếu không dùng decorators nâng cao, 
    // tạm thời khai báo any hoặc sử dụng mixins sau này.
  })
  data: T;

  @ApiPropertyOptional({
    description: 'Pagination information (only included for paginated responses)',
    type: PaginationDto
  })
  pagination?: PaginationDto;

  @ApiProperty({
    description: 'Response timestamp',
    example: '2023-06-15T10:30:00Z'
  })
  timestamp: string;
}
