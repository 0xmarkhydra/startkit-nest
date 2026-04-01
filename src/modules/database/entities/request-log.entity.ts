import {
  Column,
  Entity,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from './base.entity';
import { UserEntity } from './user.entity';
import { ApiKeyEntity } from './api-key.entity';

@Entity('request_logs')
@Index(['userId', 'created_at']) // Index for faster user-specific queries
@Index(['apiKeyId', 'created_at']) // Index for faster API key-specific queries
export class RequestLogEntity extends BaseEntity {
  @ApiProperty({
    description: 'API endpoint that was called',
    example: '/openrouter/chat/completions',
  })
  @Column()
  endpoint: string;

  @ApiProperty({
    description: 'HTTP method used',
    example: 'POST',
  })
  @Column()
  method: string;

  @ApiProperty({
    description: 'Request body (excluding sensitive data)',
    example: { model: 'LYNXAI.01', messages: [{ role: 'user', content: 'Hello' }] },
    required: false,
  })
  @Column({ type: 'jsonb', nullable: true })
  requestBody: any;

  @ApiProperty({
    description: 'Response body (excluding sensitive data)',
    example: { choices: [{ message: { role: 'assistant', content: 'Hi there!' } }] },
    required: false,
  })
  @Column({ type: 'jsonb', nullable: true })
  responseBody: any;

  @ApiProperty({
    description: 'HTTP status code returned',
    example: 200,
  })
  @Column()
  statusCode: number;

  @ApiProperty({
    description: 'AI model used for the request',
    example: 'moonshotai/kimi-k2.5',
    required: false,
  })
  @Column({ nullable: true })
  model: string;

  @ApiProperty({
    description: 'Number of prompt tokens used',
    example: 100,
    required: false,
  })
  @Column({ nullable: true })
  promptTokens: number;

  @ApiProperty({
    description: 'Number of completion tokens used',
    example: 150,
    required: false,
  })
  @Column({ nullable: true })
  completionTokens: number;

  @ApiProperty({
    description: 'Total tokens used',
    example: 250,
    required: false,
  })
  @Column({ nullable: true })
  totalTokens: number;

  @ApiProperty({
    description: 'Estimated cost of the request in USD',
    example: 0.0025,
    required: false,
  })
  @Column({ type: 'float', nullable: true })
  estimatedCost: number;

  @ApiProperty({
    description: 'Request duration in milliseconds',
    example: 1250,
  })
  @Column()
  duration: number;

  @ApiProperty({
    description: 'IP address of the requester',
    example: '192.168.1.1',
    required: false,
  })
  @Column({ nullable: true })
  ipAddress: string;

  @ApiProperty({
    description: 'User agent of the requester',
    example: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    required: false,
  })
  @Column({ nullable: true })
  userAgent: string;

  @ManyToOne(() => UserEntity, (user) => user.logs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @Column()
  userId: string;

  @ManyToOne(() => ApiKeyEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'apiKeyId' })
  apiKey: ApiKeyEntity;

  @Column()
  apiKeyId: string;
}