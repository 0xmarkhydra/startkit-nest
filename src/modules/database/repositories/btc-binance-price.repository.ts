import { DataSource, Repository } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { BtcBinancePriceEntity } from '../entities/btc-binance-price.entity';

export interface BatchInsertBinancePrice {
  timestamp: Date;
  symbol: string;
  price: number;
}

export class BtcBinancePriceRepository extends Repository<BtcBinancePriceEntity> {
  constructor(@InjectDataSource() private dataSource: DataSource) {
    super(BtcBinancePriceEntity, dataSource.createEntityManager());
  }

  /**
   * Batch insert multiple price records efficiently
   * @param prices Array of prices to insert
   */
  async batchInsert(prices: BatchInsertBinancePrice[]): Promise<void> {
    if (prices.length === 0) {
      return;
    }

    const entities = prices.map((price) =>
      this.create({
        timestamp: price.timestamp,
        symbol: price.symbol,
        price: price.price,
      }),
    );

    await this.save(entities);
  }

  /**
   * Create a single price record
   */
  async createPrice(timestamp: Date, symbol: string, price: number): Promise<BtcBinancePriceEntity> {
    const priceEntity = this.create({
      timestamp,
      symbol,
      price,
    });

    return await this.save(priceEntity);
  }
}

