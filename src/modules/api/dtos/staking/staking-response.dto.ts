import { ApiProperty } from '@nestjs/swagger';
import { StakingStatus } from '../../../database/entities/staking.entity';

export class StakingResponseDto {
  @ApiProperty({
    description: 'Staking ID',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  id: string;

  @ApiProperty({
    description: 'Wallet address',
    example: 'CuieVDEDtLo7FypA9SbLM9saXFdb1dsshEkyErMqkRQq',
  })
  walletAddress: string;

  @ApiProperty({
    description: 'Staked amount in USDC',
    example: 500,
  })
  amount: number;

  @ApiProperty({
    description: 'Expected return after 1 year',
    example: 650,
  })
  expectedReturn: number;

  @ApiProperty({
    description: 'Daily interest amount',
    example: 0.41,
  })
  dailyInterest: number;

  @ApiProperty({
    description: 'Current earnings based on staking duration',
    example: 12.3,
  })
  currentEarnings: number;

  @ApiProperty({
    description: 'Start date of staking',
    example: '2023-06-15T10:30:00Z',
  })
  startDate: Date;

  @ApiProperty({
    description: 'End date of staking',
    example: '2024-06-15T10:30:00Z',
  })
  endDate: Date;

  @ApiProperty({
    description: 'Current status of staking',
    enum: StakingStatus,
    example: StakingStatus.ACTIVE,
  })
  status: StakingStatus;

  @ApiProperty({
    description: 'Transaction hash of the deposit',
    example: '5UxV2q1Fz9S9P3wbw6zRWnKjTpT8kgT5rNyJXQxU3GY1CgBpYWcEcmP2e7Th7nahAwQcyXN6Q1Wxv2ksqdaFQrG',
  })
  transactionHash: string;

  @ApiProperty({
    description: 'Transaction hash of the withdrawal (if withdrawn)',
    example: '5UxV2q1Fz9S9P3wbw6zRWnKjTpT8kgT5rNyJXQxU3GY1CgBpYWcEcmP2e7Th7nahAwQcyXN6Q1Wxv2ksqdaFQrG',
    required: false,
  })
  withdrawalTransactionHash?: string;

  @ApiProperty({
    description: 'Date of withdrawal (if withdrawn)',
    example: '2023-07-15T10:30:00Z',
    required: false,
  })
  withdrawalDate?: Date;

  @ApiProperty({
    description: 'Creation date',
    example: '2023-06-15T10:30:00Z',
  })
  created_at: Date;
} 