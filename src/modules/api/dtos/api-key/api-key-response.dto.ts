import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiKeyResponseDto {
  @ApiProperty({
    description: 'API key ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'API key name (for user reference)',
    example: 'Production Key',
  })
  name: string;

  @ApiProperty({
    description: 'Full API key value (only shown once on creation)',
    example: 'sk-lynxai-user-abc123-12345678-90ab-cdef-1234-567890abcdef',
  })
  key: string;

  @ApiPropertyOptional({
    description: 'Prefix used in key generation',
    example: 'user-abc123',
  })
  prefix?: string;

  @ApiProperty({
    description: 'Number of requests made with this key',
    example: 150,
  })
  totalRequests: number;

  @ApiPropertyOptional({
    description: 'Last time the API key was used',
    example: '2026-04-01T10:30:00.000Z',
  })
  lastUsedAt?: Date;

  @ApiProperty({
    description: 'Whether the API key is active',
    example: true,
  })
  isActive: boolean;

  @ApiPropertyOptional({
    description: 'Expiration date of the API key',
    example: '2026-12-31T23:59:59.000Z',
  })
  expiresAt?: Date;

  @ApiProperty({
    description: 'Creation date',
    example: '2026-04-01T10:30:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update date',
    example: '2026-04-01T10:30:00.000Z',
  })
  updatedAt: Date;
}