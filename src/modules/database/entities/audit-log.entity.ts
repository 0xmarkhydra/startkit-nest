import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('audit_logs')
export class AuditLogEntity extends BaseEntity {
  @Column()
  action: string;

  @Column({ nullable: true })
  @Index()
  userId?: string;

  @Column({ nullable: true })
  address?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: any;
}

