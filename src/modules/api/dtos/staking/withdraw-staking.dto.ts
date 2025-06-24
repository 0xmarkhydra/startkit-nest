import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';
import { IsSolanaAddress } from '../../../../shared/validator/decorators/isSolanaAddress';

export class WithdrawStakingDto {
  @ApiProperty({
    description: 'Staking ID',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @IsUUID()
  @IsNotEmpty()
  stakingId: string;

  @ApiProperty({
    description: 'Solana wallet address',
    example: 'CuieVDEDtLo7FypA9SbLM9saXFdb1dsshEkyErMqkRQq',
  })
  @IsString()
  @IsNotEmpty()
  @IsSolanaAddress()
  walletAddress: string;

  @ApiProperty({
    description: 'Transaction hash of the withdrawal',
    example: '5UxV2q1Fz9S9P3wbw6zRWnKjTpT8kgT5rNyJXQxU3GY1CgBpYWcEcmP2e7Th7nahAwQcyXN6Q1Wxv2ksqdaFQrG',
  })
  @IsString()
  @IsNotEmpty()
  transactionHash: string;
} 