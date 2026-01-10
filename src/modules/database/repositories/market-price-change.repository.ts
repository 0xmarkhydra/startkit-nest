import { DataSource, Repository } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { MarketPriceChangeEntity } from '../entities/market-price-change.entity';

export interface BatchInsertPriceChange {
  market_slug: string | null;
  market_id: string | null;
  asset_id: string | null;
  price: number;
  size: number;
  side: string;
  order_hash: string | null;
  best_bid: number | null;
  best_ask: number | null;
  timestamp: Date;
}

export class MarketPriceChangeRepository extends Repository<MarketPriceChangeEntity> {
  constructor(@InjectDataSource() private dataSource: DataSource) {
    super(MarketPriceChangeEntity, dataSource.createEntityManager());
  }

  /**
   * Batch insert multiple price change records efficiently
   * @param priceChanges Array of price changes to insert
   */
  async batchInsert(priceChanges: BatchInsertPriceChange[]): Promise<void> {
    if (priceChanges.length === 0) {
      return;
    }

    const entities = priceChanges.map((pc) =>
      this.create({
        market_slug: pc.market_slug,
        market_id: pc.market_id,
        asset_id: pc.asset_id,
        price: pc.price,
        size: pc.size,
        side: pc.side,
        order_hash: pc.order_hash,
        best_bid: pc.best_bid,
        best_ask: pc.best_ask,
        timestamp: pc.timestamp,
      }),
    );

    await this.save(entities);
  }

  /**
   * Create a single price change record
   */
  async createPriceChange(data: BatchInsertPriceChange): Promise<MarketPriceChangeEntity> {
    const priceChange = this.create({
      market_slug: data.market_slug,
      market_id: data.market_id,
      asset_id: data.asset_id,
      price: data.price,
      size: data.size,
      side: data.side,
      order_hash: data.order_hash,
      best_bid: data.best_bid,
      best_ask: data.best_ask,
      timestamp: data.timestamp,
    });

    return await this.save(priceChange);
  }
}

