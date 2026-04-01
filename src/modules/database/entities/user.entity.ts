import {
  Column,
  Entity,
  OneToMany,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from './base.entity';
import { ApiKeyEntity } from './api-key.entity';
import { RequestLogEntity } from './request-log.entity';

@Entity('users')
export class UserEntity extends BaseEntity {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @Column({ unique: true })
  email: string;

  @Column()
  hashedPassword: string;

  @ApiProperty({
    description: 'User display name',
    example: 'John Doe',
    required: false,
  })
  @Column({ nullable: true })
  displayName: string;

  @ApiProperty({
    description: 'User role',
    example: 'user',
    enum: ['user', 'admin'],
  })
  @Column({ default: 'user' })
  role: 'user' | 'admin';

  @ApiProperty({
    description: 'Whether the user account is active',
    example: true,
  })
  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => ApiKeyEntity, (apiKey) => apiKey.user)
  apiKeys: ApiKeyEntity[];

  @OneToMany(() => RequestLogEntity, (log) => log.user)
  logs: RequestLogEntity[];
}