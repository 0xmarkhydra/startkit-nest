import { Entity, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Investment } from './investment.entity';
import { WithdrawalRequest } from './withdrawal-request.entity';

@Entity('users')
export class User extends BaseEntity {
  @Column({ unique: true, length: 44, nullable: true })
  walletAddress?: string;

  @Column({ type: 'varchar', length: 100, nullable: true, unique: true })
  email?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  passwordHash?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  name?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  firstName?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  lastName?: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt?: Date;

  @OneToMany(() => Investment, investment => investment.user)
  investments: Investment[];

  @OneToMany(() => WithdrawalRequest, withdrawal => withdrawal.user)
  withdrawalRequests: WithdrawalRequest[];
} 