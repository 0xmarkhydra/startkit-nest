import { Entity, Column, Index, Unique } from 'typeorm';
import { BaseEntity } from './base.entity';
import { MarketStatus } from '@/shared/constants/polymarket.constants';

@Entity('market_registry')
@Unique(['slug'])
export class MarketRegistryEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 255, unique: true })
  slug: string;

  @Column({ type: 'varchar', length: 255 })
  condition_id: string;

  @Column({ type: 'varchar', length: 255 })
  asset_yes_id: string;

  @Column({ type: 'varchar', length: 255 })
  asset_no_id: string;

  @Column({ type: 'bigint' })
  @Index('idx_market_start')
  start_timestamp: number;

  @Column({ type: 'bigint' })
  end_timestamp: number;

  @Column({ type: 'varchar', length: 20, default: MarketStatus.UPCOMING })
  @Index('idx_market_status')
  status: MarketStatus;

  @Column({ type: 'timestamp', nullable: true })
  subscribed_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  unsubscribed_at: Date | null;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  open_price: number | null;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  close_price: number | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  type_win: 'UP' | 'DOWN' | null;
}

