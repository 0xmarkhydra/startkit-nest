import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength, MaxLength, IsOptional } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'User password (minimum 8 characters, maximum 128 characters)',
    example: 'SecurePassword123!',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @ApiProperty({
    description: 'User display name',
    example: 'John Doe',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  displayName?: string;
}