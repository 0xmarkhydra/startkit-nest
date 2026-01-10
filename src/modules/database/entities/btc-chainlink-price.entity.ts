import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('btc_chainlink_prices')
@Index('idx_btc_chainlink_symbol_timestamp', ['symbol', 'timestamp'])
@Index('idx_btc_chainlink_timestamp', ['timestamp'])
export class BtcChainlinkPriceEntity extends BaseEntity {
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  @Index('idx_btc_chainlink_price_timestamp')
  timestamp: Date; // Price timestamp from Chainlink oracle

  @Column({ type: 'varchar', length: 20, default: 'btc/usd' })
  @Index('idx_btc_chainlink_symbol')
  symbol: string; // Symbol: "btc/usd" (lowercase)

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  price: number; // BTC/USD price from Chainlink oracle
}

