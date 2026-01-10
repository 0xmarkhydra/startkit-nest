import { DataSource, Repository, IsNull, Or } from 'typeorm';
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
  index_15m?: number | null;
}

/**
 * Calculate index_15m from start_timestamp
 * Index represents the position of 15-minute market in a day (1-96, 96 markets per day)
 * Index starts from 1, not 0
 * @param startTimestamp Unix timestamp in seconds
 * @returns Index (1-96) or null if invalid
 */
export function calculateIndex15m(startTimestamp: number): number | null {
  try {
    // Get start of day (00:00:00 UTC) for the given timestamp
    const date = new Date(startTimestamp * 1000);
    const startOfDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
    const startOfDayTimestamp = Math.floor(startOfDay.getTime() / 1000);

    // Calculate seconds from start of day
    const secondsFromStartOfDay = startTimestamp - startOfDayTimestamp;

    // Divide by 900 (15 minutes = 900 seconds) to get base index (0-95)
    // 1 day = 24 hours * 60 minutes / 15 minutes = 96 markets
    const baseIndex = Math.floor(secondsFromStartOfDay / 900);

    // Convert to 1-based index (1-96)
    const index = baseIndex + 1;

    // Validate index is within range (1-96)
    if (index >= 1 && index <= 96) {
      return index;
    }

    return null;
  } catch (error) {
    return null;
  }
}

export class MarketRegistryRepository extends Repository<MarketRegistryEntity> {
  constructor(@InjectDataSource() private dataSource: DataSource) {
    super(MarketRegistryEntity, dataSource.createEntityManager());
  }

  /**
   * Create or update market registry entry
   * Uses ON CONFLICT to handle duplicates by slug
   * Automatically calculates index_15m from start_timestamp if not provided
   */
  async upsertMarket(data: CreateMarketRegistryData): Promise<MarketRegistryEntity> {
    // Calculate index_15m from start_timestamp
    // Always recalculate to ensure consistency (don't use existing.index_15m if it's wrong)
    const index_15m = data.index_15m !== undefined ? data.index_15m : calculateIndex15m(data.start_timestamp);

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

      // Always recalculate index_15m from start_timestamp to ensure correctness
      // This ensures that even if start_timestamp changes, index_15m will be updated
      // Priority: provided index > recalculated from start_timestamp > existing index
      const finalIndex_15m = data.index_15m !== undefined && data.index_15m !== null
        ? data.index_15m
        : calculateIndex15m(data.start_timestamp) ?? existing.index_15m;

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
        index_15m: finalIndex_15m, // Always update from start_timestamp to prevent duplicates
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
      index_15m: index_15m || null,
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
   * Find ended markets that need closePrice update
   * Markets with status = ENDED but missing close_price (if close_price is null, type_win will also be null)
   */
  async findEndedMarketsNeedingUpdate(): Promise<MarketRegistryEntity[]> {
    // Use query builder to find markets with status = ENDED AND close_price IS NULL
    // Note: If close_price is null, type_win will also be null (it depends on close_price)
    return await this.createQueryBuilder('market')
      .where('market.status = :status', { status: MarketStatus.ENDED })
      .andWhere('market.close_price IS NULL')
      .orderBy('market.end_timestamp', 'DESC')
      .getMany();
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

