import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEthereumAddress } from 'class-validator';
import { Transform } from 'class-transformer';

export class GetPrivateKeyDto {
  @ApiPropertyOptional({
    description: 'User ID to get private key',
    example: 'user_123456',
  })
  @IsOptional()
  @IsString()
  user_id?: string;

  @ApiPropertyOptional({
    description: 'Wallet address to get private key (case-insensitive)',
    example: '0xAbCDef1234567890aBCdEF1234567890abCDef12',
  })
  @IsOptional()
  @IsEthereumAddress()
  @Transform(({ value }) => value?.toLowerCase())
  address?: string;
}

