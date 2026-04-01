import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, MaxLength, MinLength } from 'class-validator';

export class CreateApiKeyDto {
  @ApiProperty({
    description: 'Name for the API key (for user reference)',
    example: 'Production Key',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    description: 'Custom prefix for the API key (optional, auto-generated if not provided)',
    example: 'myapp',
  })
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(20)
  prefix?: string;

  @ApiPropertyOptional({
    description: 'Expiration date for the API key (optional)',
    example: '2026-12-31T23:59:59.000Z',
  })
  @IsString()
  @IsOptional()
  expiresAt?: string;
}