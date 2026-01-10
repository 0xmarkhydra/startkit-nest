import { DataSource, Repository } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { BtcChainlinkPriceEntity } from '../entities/btc-chainlink-price.entity';

export interface BatchInsertPrice {
  timestamp: Date;
  symbol: string;
  price: number;
}

export class BtcChainlinkPriceRepository extends Repository<BtcChainlinkPriceEntity> {
  constructor(@InjectDataSource() private dataSource: DataSource) {
    super(BtcChainlinkPriceEntity, dataSource.createEntityManager());
  }

  /**
   * Batch insert multiple price records efficiently
   * @param prices Array of prices to insert
   */
  async batchInsert(prices: BatchInsertPrice[]): Promise<void> {
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
  async createPrice(timestamp: Date, symbol: string, price: number): Promise<BtcChainlinkPriceEntity> {
    const priceEntity = this.create({
      timestamp,
      symbol,
      price,
    });

    return await this.save(priceEntity);
  }
}

