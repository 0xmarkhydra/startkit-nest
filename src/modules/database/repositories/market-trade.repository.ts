import { DataSource, Repository } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { MarketTradeEntity } from '../entities/market-trade.entity';

export interface CreateMarketTradeData {
  market_slug: string | null;
  market_id: string | null; // condition_id
  asset_id: string | null;
  price: number;
  size: number;
  side: string; // "BUY" or "SELL"
  fee_rate_bps: number | null;
  type: 'YES' | 'NO';
  timestamp: Date;
  price_chainlink?: number | null; // Current Chainlink BTC/USD price
  delta_price?: number | null; // Delta price = price_chainlink - open_price
}

export interface BatchInsertTrade {
  market_slug: string | null;
  market_id: string | null;
  asset_id: string | null;
  price: number;
  size: number;
  side: string;
  fee_rate_bps: number | null;
  type: 'YES' | 'NO';
  timestamp: Date;
  price_chainlink?: number | null; // Current Chainlink BTC/USD price
  delta_price?: number | null; // Delta price = price_chainlink - open_price
}

export class MarketTradeRepository extends Repository<MarketTradeEntity> {
  constructor(@InjectDataSource() private dataSource: DataSource) {
    super(MarketTradeEntity, dataSource.createEntityManager());
  }

  /**
   * Batch insert multiple trades efficiently
   * @param trades Array of trades to insert
   */
  async batchInsert(trades: BatchInsertTrade[]): Promise<void> {
    if (trades.length === 0) {
      return;
    }

    const entities = trades.map((trade) =>
      this.create({
        market_slug: trade.market_slug,
        market_id: trade.market_id,
        asset_id: trade.asset_id,
        price: trade.price,
        size: trade.size,
        side: trade.side,
        fee_rate_bps: trade.fee_rate_bps,
        type: trade.type,
        timestamp: trade.timestamp,
        price_chainlink: trade.price_chainlink ?? null,
        delta_price: trade.delta_price ?? null,
      }),
    );

    await this.save(entities);
  }

  /**
   * Create a single trade record
   */
  async createTrade(data: CreateMarketTradeData): Promise<MarketTradeEntity> {
    const trade = this.create({
      market_slug: data.market_slug,
      market_id: data.market_id,
      asset_id: data.asset_id,
      price: data.price,
      size: data.size,
      side: data.side,
      fee_rate_bps: data.fee_rate_bps,
      type: data.type,
      timestamp: data.timestamp,
      price_chainlink: data.price_chainlink ?? null,
      delta_price: data.delta_price ?? null,
    });

    return await this.save(trade);
  }
}

