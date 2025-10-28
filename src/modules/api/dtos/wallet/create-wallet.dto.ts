import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateWalletDto {
  @ApiProperty({
    description: 'User ID to create wallet for',
    example: 'user_123456',
  })
  @IsString()
  @IsNotEmpty()
  user_id: string;
}

