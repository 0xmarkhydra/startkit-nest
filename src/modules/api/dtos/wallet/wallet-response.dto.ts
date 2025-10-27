import { ApiProperty } from '@nestjs/swagger';

export class WalletResponseDto {
  @ApiProperty({
    description: 'Wallet ID',
    example: 'd1fb2a2c-7f40-4d1b-8a8e-76a9d0176c33',
  })
  wallet_id: string;

  @ApiProperty({
    description: 'User ID',
    example: '2d9b2c46-2a9e-4d1b-8bdf-8b7f9d7a0ef1',
  })
  user_id: string;

  @ApiProperty({
    description: 'Chain ID',
    example: 8453,
  })
  chain_id: number;

  @ApiProperty({
    description: 'Wallet address',
    example: '0xAbCDef1234567890aBCdEF1234567890abCDef12',
  })
  address: string;

  @ApiProperty({
    description: 'Created timestamp',
    example: '2025-10-27T08:00:00Z',
  })
  created_at: string;
}

