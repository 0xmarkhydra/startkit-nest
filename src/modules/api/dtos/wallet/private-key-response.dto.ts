import { ApiProperty } from '@nestjs/swagger';

export class PrivateKeyResponseDto {
  @ApiProperty({
    description: 'Wallet address',
    example: '0xAbCDef1234567890aBCdEF1234567890abCDef12',
  })
  address: string;

  @ApiProperty({
    description: 'Decrypted private key (only for admin)',
    example: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  })
  private_key: string;
}

