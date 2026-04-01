import {
  Column,
  Entity,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from './base.entity';
import { UserEntity } from './user.entity';

@Entity('api_keys')
export class ApiKeyEntity extends BaseEntity {
  @ApiProperty({
    description: 'API Key value',
    example: 'sk-lynxai-user-abc123-12345678-90ab-cdef-1234-567890abcdef',
  })
  @Column({ unique: true })
  key: string;

  @ApiProperty({
    description: 'Hashed version of the API key for verification',
  })
  @Column()
  hashedKey: string;

  @ApiProperty({
    description: 'User-defined name for the API key',
    example: 'Production Key',
  })
  @Column()
  name: string;

  @ApiProperty({
    description: 'Prefix used in key generation',
    example: 'user-abc123',
    required: false,
  })
  @Column({ nullable: true })
  prefix: string;

  @ApiProperty({
    description: 'Last time the API key was used',
    example: '2026-04-01T10:30:00.000Z',
    required: false,
  })
  @Column({ nullable: true })
  lastUsedAt: Date;

  @ApiProperty({
    description: 'Total number of requests made with this key',
    example: 150,
  })
  @Column({ default: 0 })
  totalRequests: number;

  @ApiProperty({
    description: 'Whether the API key is active',
    example: true,
  })
  @Column({ default: true })
  isActive: boolean;

  @ApiProperty({
    description: 'Expiration date of the API key',
    example: '2026-12-31T23:59:59.000Z',
    required: false,
  })
  @Column({ nullable: true })
  expiresAt: Date;

  @ManyToOne(() => UserEntity, (user) => user.apiKeys, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @Column()
  userId: string;
}