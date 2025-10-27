import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEthereumAddress } from 'class-validator';

export class GetPrivateKeyDto {
  @ApiPropertyOptional({
    description: 'User ID to get private key',
    example: '2d9b2c46-2a9e-4d1b-8bdf-8b7f9d7a0ef1',
  })
  @IsOptional()
  @IsString()
  user_id?: string;

  @ApiPropertyOptional({
    description: 'Wallet address to get private key',
    example: '0xAbCDef1234567890aBCdEF1234567890abCDef12',
  })
  @IsOptional()
  @IsEthereumAddress()
  address?: string;
}

