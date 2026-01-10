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
  open_price?: number | null;
  close_price?: number | null;
  type_win?: 'UP' | 'DOWN' | null;
}

export class MarketRegistryRepository extends Repository<MarketRegistryEntity> {
  constructor(@InjectDataSource() private dataSource: DataSource) {
    super(MarketRegistryEntity, dataSource.createEntityManager());
  }

  /**
   * Create or update market registry entry
   * Uses ON CONFLICT to handle duplicates by slug
   */
  async upsertMarket(data: CreateMarketRegistryData): Promise<MarketRegistryEntity> {
    // Find existing market by slug (including soft-deleted ones)
    const existing = await this.findOne({
      where: { slug: data.slug },
      withDeleted: true, // Include soft-deleted records
    });

    if (existing) {
      // Restore if soft-deleted
      if (existing.deleted_at) {
        await this.restore({ id: existing.id });
      }

      // Update existing market
      Object.assign(existing, {
        condition_id: data.condition_id,
        asset_yes_id: data.asset_yes_id,
        asset_no_id: data.asset_no_id,
        start_timestamp: data.start_timestamp,
        end_timestamp: data.end_timestamp,
        status: data.status || existing.status,
        subscribed_at: data.subscribed_at || existing.subscribed_at,
        open_price: data.open_price !== undefined ? data.open_price : existing.open_price,
        close_price: data.close_price !== undefined ? data.close_price : existing.close_price,
        type_win: data.type_win !== undefined ? data.type_win : existing.type_win,
        deleted_at: null, // Clear soft delete if exists
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
      open_price: data.open_price || null,
      close_price: data.close_price || null,
      type_win: data.type_win || null,
    });

    return await this.save(market);
  }

  /**
   * Find market by id (including soft-deleted)
   */
  async findById(id: string, includeDeleted: boolean = false): Promise<MarketRegistryEntity | null> {
    return await this.findOne({
      where: { id },
      withDeleted: includeDeleted,
    });
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

  /**
   * Update crypto prices and win type for a market
   * @param slug Market slug
   * @param openPrice Open price (optional)
   * @param closePrice Close price (optional)
   * @param typeWin Win type UP/DOWN (optional)
   */
  async updateCryptoPrices(
    slug: string,
    openPrice?: number | null,
    closePrice?: number | null,
    typeWin?: 'UP' | 'DOWN' | null,
  ): Promise<void> {
    const updateData: Partial<MarketRegistryEntity> = {
      updated_at: new Date(),
    };

    if (openPrice !== undefined) {
      updateData.open_price = openPrice;
    }
    if (closePrice !== undefined) {
      updateData.close_price = closePrice;
    }
    if (typeWin !== undefined) {
      updateData.type_win = typeWin;
    }

    await this.update({ slug }, updateData);
  }
}

