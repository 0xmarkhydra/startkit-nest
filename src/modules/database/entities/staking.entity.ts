import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum StakingStatus {
  ACTIVE = 'active',
  WITHDRAWN = 'withdrawn',
  COMPLETED = 'completed',
}

@Entity('stakings')
export class StakingEntity extends BaseEntity {
  @Column({ name: 'wallet_address' })
  @Index()
  walletAddress: string;

  @Column({ name: 'amount', type: 'decimal', precision: 20, scale: 6 })
  amount: number;

  @Column({ name: 'expected_return', type: 'decimal', precision: 20, scale: 6 })
  expectedReturn: number;

  @Column({ name: 'daily_interest', type: 'decimal', precision: 20, scale: 6 })
  dailyInterest: number;

  @Column({ name: 'start_date', type: 'timestamp' })
  startDate: Date;

  @Column({ name: 'end_date', type: 'timestamp' })
  endDate: Date;

  @Column({
    name: 'status',
    type: 'enum',
    enum: StakingStatus,
    default: StakingStatus.ACTIVE,
  })
  status: StakingStatus;

  @Column({ name: 'transaction_hash', nullable: true })
  transactionHash: string;

  @Column({ name: 'withdrawal_transaction_hash', nullable: true })
  withdrawalTransactionHash: string;

  @Column({ name: 'withdrawal_date', type: 'timestamp', nullable: true })
  withdrawalDate: Date;
} 