import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('btc_binance_prices')
@Index('idx_btc_binance_symbol_timestamp', ['symbol', 'timestamp'])
@Index('idx_btc_binance_timestamp', ['timestamp'])
export class BtcBinancePriceEntity extends BaseEntity {
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  @Index('idx_btc_binance_price_timestamp')
  timestamp: Date; // Price timestamp from Binance

  @Column({ type: 'varchar', length: 20, default: 'btcusdt' })
  @Index('idx_btc_binance_symbol')
  symbol: string; // Symbol: "btcusdt" (lowercase)

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  price: number; // BTC/USDT price from Binance
}

