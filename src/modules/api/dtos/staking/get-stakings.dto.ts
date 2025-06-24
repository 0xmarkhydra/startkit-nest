import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { IsSolanaAddress } from '../../../../shared/validator/decorators/isSolanaAddress';

export class GetStakingsDto {
  @ApiProperty({
    description: 'Solana wallet address',
    example: 'CuieVDEDtLo7FypA9SbLM9saXFdb1dsshEkyErMqkRQq',
  })
  @IsString()
  @IsNotEmpty()
  @IsSolanaAddress()
  walletAddress: string;
} 