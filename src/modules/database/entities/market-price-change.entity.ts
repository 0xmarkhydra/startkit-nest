import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('market_price_changes')
@Index(['market_slug', 'asset_id', 'timestamp'])
@Index(['market_slug', 'timestamp'])
@Index(['asset_id', 'timestamp'])
@Index(['side', 'timestamp'])
export class MarketPriceChangeEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 255, nullable: true })
  market_slug: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  market_id: string | null; // condition_id or market_slug

  @Column({ type: 'varchar', length: 255, nullable: true })
  @Index('idx_price_change_asset_id')
  asset_id: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  price: number; // Price level bị ảnh hưởng

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  size: number; // New aggregate size tại price level đó

  @Column({ type: 'varchar', length: 10 })
  @Index('idx_price_change_side')
  side: string; // "BUY" or "SELL"

  @Column({ type: 'varchar', length: 255, nullable: true })
  order_hash: string | null; // Hash của order gây ra thay đổi

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  best_bid: number | null; // Best bid sau khi change

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  best_ask: number | null; // Best ask sau khi change

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  @Index('idx_price_change_timestamp')
  timestamp: Date; // Price change timestamp from event
}

