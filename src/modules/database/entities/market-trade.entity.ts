import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('market_trades')
@Index(['market_slug', 'timestamp'])
@Index(['market_slug', 'asset_id', 'timestamp'])
@Index(['market_slug', 'type', 'timestamp'])
@Index(['asset_id', 'timestamp'])
export class MarketTradeEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 255, nullable: true })
  market_slug: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  market_id: string | null; // condition_id from event

  @Column({ type: 'varchar', length: 255, nullable: true })
  @Index('idx_trade_asset_id')
  asset_id: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  price: number;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  size: number;

  @Column({ type: 'varchar', length: 10 })
  side: string; // "BUY" or "SELL"

  @Column({ type: 'integer', nullable: true })
  fee_rate_bps: number | null; // Fee rate in basis points

  @Column({ type: 'varchar', length: 10 })
  @Index('idx_trade_type')
  type: 'YES' | 'NO'; // Type of trade: YES or NO

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  @Index('idx_trade_timestamp')
  timestamp: Date; // Trade timestamp from event

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  price_chainlink: number | null; // Current Chainlink BTC/USD price at trade time

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  delta_price: number | null; // Delta price = price_chainlink - open_price

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  price_binance: number | null; // Current Binance BTC/USDT price at trade time

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  price_binance_diff: number | null; // Delta = price_binance - price_chainlink
}

