import { Entity, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

export enum InvestmentStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  MATURED = 'matured',
  WITHDRAWN = 'withdrawn',
  CANCELLED = 'cancelled'
}

@Entity('investments')
export class Investment extends BaseEntity {
  @ManyToOne(() => User, user => user.investments)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  principalAmount: number;

  @Column({ type: 'decimal', precision: 5, scale: 4, default: 0.30 })
  interestRate: number; // 30% = 0.30

  @Column({ type: 'int', default: 365 })
  termDays: number; // Investment term in days

  @Column({ type: 'timestamp' })
  startDate: Date;

  @Column({ type: 'timestamp' })
  maturityDate: Date;

  @Column({ 
    type: 'enum', 
    enum: InvestmentStatus, 
    default: InvestmentStatus.PENDING 
  })
  status: InvestmentStatus;

  @Column({ type: 'varchar', length: 100, nullable: true })
  depositTxHash?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  withdrawalTxHash?: string;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  accruedInterest: number;

  @Column({ type: 'timestamp', nullable: true })
  lastInterestCalculation?: Date;

  // Calculate current earned interest
  getCurrentInterest(): number {
    if (this.status !== InvestmentStatus.ACTIVE) return this.accruedInterest;
    
    const now = new Date();
    const startTime = this.startDate.getTime();
    const currentTime = Math.min(now.getTime(), this.maturityDate.getTime());
    const termMs = this.termDays * 24 * 60 * 60 * 1000;
    const elapsedMs = currentTime - startTime;
    
    const progressRatio = elapsedMs / termMs;
    return this.principalAmount * this.interestRate * progressRatio;
  }

  // Check if investment is matured
  isMatured(): boolean {
    return new Date() >= this.maturityDate;
  }
} 