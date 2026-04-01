import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({
    description: 'User ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'User display name',
    example: 'John Doe',
    required: false,
  })
  displayName?: string;

  @ApiProperty({
    description: 'User role',
    example: 'user',
    enum: ['user', 'admin'],
  })
  role: 'user' | 'admin';

  @ApiProperty({
    description: 'Whether the user account is active',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Account creation date',
    example: '2026-04-01T10:30:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last account update date',
    example: '2026-04-01T10:30:00.000Z',
  })
  updatedAt: Date;
}