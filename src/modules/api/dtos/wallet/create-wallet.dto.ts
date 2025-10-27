import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateWalletDto {
  @ApiProperty({
    description: 'User ID to create wallet for',
    example: '2d9b2c46-2a9e-4d1b-8bdf-8b7f9d7a0ef1',
  })
  @IsUUID()
  @IsNotEmpty()
  user_id: string;
}

