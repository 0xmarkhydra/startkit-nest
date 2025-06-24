import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';
import { IsSolanaAddress } from '../../../../shared/validator/decorators/isSolanaAddress';

export class CreateStakingDto {
  @ApiProperty({
    description: 'Solana wallet address',
    example: 'CuieVDEDtLo7FypA9SbLM9saXFdb1dsshEkyErMqkRQq',
  })
  @IsString()
  @IsNotEmpty()
  @IsSolanaAddress()
  walletAddress: string;

  @ApiProperty({
    description: 'Amount to stake in USDC (minimum 1 USDC)',
    example: 100,
    minimum: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  @Min(1)
  amount: number;

  @ApiProperty({
    description: 'Transaction hash of the deposit',
    example: '5UxV2q1Fz9S9P3wbw6zRWnKjTpT8kgT5rNyJXQxU3GY1CgBpYWcEcmP2e7Th7nahAwQcyXN6Q1Wxv2ksqdaFQrG',
  })
  @IsString()
  @IsNotEmpty()
  transactionHash: string;
} 