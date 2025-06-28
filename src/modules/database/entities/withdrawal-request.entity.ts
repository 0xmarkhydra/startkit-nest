import { Entity, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

export enum WithdrawalStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  FAILED = 'failed'
}

@Entity('withdrawal_requests')
export class WithdrawalRequest extends BaseEntity {
  @ManyToOne(() => User, user => user.withdrawalRequests)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  amount: number;

  @Column({ 
    type: 'enum', 
    enum: WithdrawalStatus, 
    default: WithdrawalStatus.PENDING 
  })
  status: WithdrawalStatus;

  @Column({ type: 'timestamp' })
  requestedAt: Date;

  @Column({ type: 'timestamp' })
  processAt: Date; // 24 hours after requestedAt

  @Column({ type: 'timestamp', nullable: true })
  processedAt?: Date;

  @Column({ type: 'varchar', length: 100, nullable: true })
  txHash?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'text', nullable: true })
  failureReason?: string;

  // Check if withdrawal is ready to process
  isReadyToProcess(): boolean {
    return new Date() >= this.processAt && this.status === WithdrawalStatus.PENDING;
  }
} 