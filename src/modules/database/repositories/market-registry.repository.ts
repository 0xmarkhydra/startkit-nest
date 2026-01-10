import { DataSource, Repository } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { MarketRegistryEntity } from '../entities/market-registry.entity';
import { MarketStatus } from '@/shared/constants/polymarket.constants';

export interface CreateMarketRegistryData {
  slug: string;
  condition_id: string;
  asset_yes_id: string;
  asset_no_id: string;
  start_timestamp: number;
  end_timestamp: number;
  status?: MarketStatus;
  subscribed_at?: Date;
}

export class MarketRegistryRepository extends Repository<MarketRegistryEntity> {
  constructor(@InjectDataSource() private dataSource: DataSource) {
    super(MarketRegistryEntity, dataSource.createEntityManager());
  }

  /**
   * Create or update market registry entry
   * Uses ON CONFLICT to handle duplicates
   */
  async upsertMarket(data: CreateMarketRegistryData): Promise<MarketRegistryEntity> {
    const existing = await this.findOne({ where: { slug: data.slug } });

    if (existing) {
      // Update existing market
      Object.assign(existing, {
        condition_id: data.condition_id,
        asset_yes_id: data.asset_yes_id,
        asset_no_id: data.asset_no_id,
        start_timestamp: data.start_timestamp,
        end_timestamp: data.end_timestamp,
        status: data.status || existing.status,
        subscribed_at: data.subscribed_at || existing.subscribed_at,
        updated_at: new Date(),
      });
      return await this.save(existing);
    }

    // Create new market
    const market = this.create({
      slug: data.slug,
      condition_id: data.condition_id,
      asset_yes_id: data.asset_yes_id,
      asset_no_id: data.asset_no_id,
      start_timestamp: data.start_timestamp,
      end_timestamp: data.end_timestamp,
      status: data.status || MarketStatus.UPCOMING,
      subscribed_at: data.subscribed_at || new Date(),
    });

    return await this.save(market);
  }

  /**
   * Find market by slug
   */
  async findBySlug(slug: string): Promise<MarketRegistryEntity | null> {
    return await this.findOne({ where: { slug } });
  }

  /**
   * Find markets by status
   */
  async findByStatus(status: MarketStatus): Promise<MarketRegistryEntity[]> {
    return await this.find({ where: { status } });
  }

  /**
   * Update market status
   */
  async updateStatus(
    slug: string,
    status: MarketStatus,
    unsubscribedAt?: Date,
  ): Promise<void> {
    await this.update(
      { slug },
      {
        status,
        unsubscribed_at: unsubscribedAt || null,
        updated_at: new Date(),
      },
    );
  }

  /**
   * Find current active market
   */
  async findCurrentActiveMarket(): Promise<MarketRegistryEntity | null> {
    return await this.findOne({
      where: { status: MarketStatus.ACTIVE },
      order: { start_timestamp: 'DESC' },
    });
  }

  /**
   * Find upcoming markets
   */
  async findUpcomingMarkets(): Promise<MarketRegistryEntity[]> {
    return await this.find({
      where: { status: MarketStatus.UPCOMING },
      order: { start_timestamp: 'ASC' },
    });
  }
}

