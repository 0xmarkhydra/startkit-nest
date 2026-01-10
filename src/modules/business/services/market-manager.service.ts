import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  MARKET_DURATION,
  OVERLAP_BEFORE,
  OVERLAP_AFTER,
  MONITOR_INTERVAL,
  MarketStatus,
  MarketWinType,
} from '@/shared/constants/polymarket.constants';
import { PolymarketGammaService, MarketInfo } from './polymarket-gamma.service';
import { PolymarketWebSocketCollectorService } from './polymarket-websocket-collector.service';
import { PolymarketCryptoPriceService } from './polymarket-crypto-price.service';
import { MarketRegistryRepository, CreateMarketRegistryData } from '@/database/repositories/market-registry.repository';
import { MarketRegistryEntity } from '@/database/entities/market-registry.entity';

interface MarketData extends MarketInfo {
  slug: string;
}

@Injectable()
export class MarketManagerService implements OnModuleDestroy {
  private currentMarket: MarketData | null = null;
  private upcomingMarket: MarketData | null = null;
  private monitorInterval: NodeJS.Timeout | null = null;
  private overlapTimeout: NodeJS.Timeout | null = null;
  private isInitialized: boolean = false;

  constructor(
    private readonly gammaService: PolymarketGammaService,
    private readonly wsCollector: PolymarketWebSocketCollectorService,
    private readonly marketRegistry: MarketRegistryRepository,
    private readonly cryptoPriceService: PolymarketCryptoPriceService,
    @InjectPinoLogger(MarketManagerService.name) private readonly logger: PinoLogger,
  ) {}

  /**
   * Initialize market manager - fetch current and upcoming markets, subscribe, and start monitoring
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn('⚠️ [MarketManagerService] [initialize] Already initialized');
      return;
    }

    try {
      this.logger.info('🔄 [MarketManagerService] [initialize] Initializing market manager');

      // Ensure WebSocket is connected
      if (!this.wsCollector.getConnectionStatus()) {
        await this.wsCollector.connect();
        // Wait a bit for connection to stabilize
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      // Check if markets already exist in database (from previous run)
      // This prevents creating duplicate markets and updating ENDED markets incorrectly
      const currentSlug = this.calculateCurrentMarketSlug();
      const existingCurrentMarket = await this.marketRegistry.findBySlug(currentSlug);

      if (existingCurrentMarket && existingCurrentMarket.status === MarketStatus.ACTIVE) {
        // Reuse existing ACTIVE market from database
        this.logger.info(
          { slug: currentSlug, id: existingCurrentMarket.id },
          '✅ [MarketManagerService] [initialize] Reusing existing ACTIVE market from database',
        );
        this.currentMarket = {
          slug: existingCurrentMarket.slug,
          conditionId: existingCurrentMarket.condition_id,
          assetYesId: existingCurrentMarket.asset_yes_id,
          assetNoId: existingCurrentMarket.asset_no_id,
          startTimestamp: existingCurrentMarket.start_timestamp,
          endTimestamp: existingCurrentMarket.end_timestamp,
        };
      } else {
        // Fetch current market from API (if not exists or status is not ACTIVE)
        this.logger.info({ slug: currentSlug }, '🔄 [MarketManagerService] [initialize] Fetching current market from API');
        const currentMarketInfo = await this.fetchMarket(currentSlug);

        if (!currentMarketInfo) {
          // Try previous cycle if current not found
          const previousSlug = this.calculatePreviousMarketSlug();
          this.logger.warn({ slug: previousSlug }, '⚠️ [MarketManagerService] [initialize] Current market not found, trying previous');
          const previousMarketInfo = await this.fetchMarket(previousSlug);
          if (!previousMarketInfo) {
            throw new Error('Failed to fetch current or previous market');
          }
          this.currentMarket = { ...previousMarketInfo, slug: previousSlug };
        } else {
          this.currentMarket = { ...currentMarketInfo, slug: currentSlug };
        }
        
        // Save current market to database (only if not exists or status changed)
        await this.saveMarketToRegistry(this.currentMarket, MarketStatus.ACTIVE);
      }

      // Fetch upcoming market (B)
      // According to LOGIC.md: "next market = current market endTimestamp"
      // Extract timestamp from current market slug and add MARKET_DURATION to get next market slug
      // This ensures consistency with slug pattern even if API timestamps don't match
      const currentSlugTimestamp = this.extractTimestampFromSlug(this.currentMarket.slug);
      if (!currentSlugTimestamp) {
        throw new Error('Failed to extract timestamp from current market slug');
      }
      const upcomingStartTimestamp = currentSlugTimestamp + MARKET_DURATION;
      const upcomingSlug = `btc-updown-15m-${upcomingStartTimestamp}`;
      
      // Check if upcoming market already exists in database
      const existingUpcomingMarket = await this.marketRegistry.findBySlug(upcomingSlug);

      if (existingUpcomingMarket && existingUpcomingMarket.status === MarketStatus.UPCOMING) {
        // Reuse existing UPCOMING market from database
        this.logger.info(
          { slug: upcomingSlug, id: existingUpcomingMarket.id },
          '✅ [MarketManagerService] [initialize] Reusing existing UPCOMING market from database',
        );
        this.upcomingMarket = {
          slug: existingUpcomingMarket.slug,
          conditionId: existingUpcomingMarket.condition_id,
          assetYesId: existingUpcomingMarket.asset_yes_id,
          assetNoId: existingUpcomingMarket.asset_no_id,
          startTimestamp: existingUpcomingMarket.start_timestamp,
          endTimestamp: existingUpcomingMarket.end_timestamp,
        };
      } else {
        // Fetch upcoming market from API (if not exists or status is not UPCOMING)
        this.logger.info(
          {
            slug: upcomingSlug,
            currentSlug: this.currentMarket.slug,
            currentSlugTimestamp,
            upcomingStartTimestamp,
            currentEndTimestamp: this.currentMarket.endTimestamp,
          },
          '🔄 [MarketManagerService] [initialize] Fetching upcoming market from API',
        );
        const upcomingMarketInfo = await this.fetchMarket(upcomingSlug);

        if (!upcomingMarketInfo) {
          throw new Error('Failed to fetch upcoming market');
        }
        this.upcomingMarket = { ...upcomingMarketInfo, slug: upcomingSlug };
        
        // Save upcoming market to database (only if not exists or status changed)
        await this.saveMarketToRegistry(this.upcomingMarket, MarketStatus.UPCOMING);
      }

      // Subscribe to markets first (don't block on openPrice fetch)
      await this.subscribeToMarket(this.currentMarket, MarketStatus.ACTIVE);
      await this.subscribeToMarket(this.upcomingMarket, MarketStatus.UPCOMING);

      // Fetch openPrice for current market when it starts - fire-and-forget to avoid blocking
      // This will retry in background, won't block initialization
      this.fetchAndSaveOpenPrice(this.currentMarket).catch((error) => {
        this.logger.error(
          { slug: this.currentMarket.slug, error: error instanceof Error ? error.message : String(error) },
          '🔴 [MarketManagerService] [initialize] Error in background fetchAndSaveOpenPrice',
        );
      });

      // Schedule overlap subscription (30s before current market ends)
      this.scheduleOverlapSubscription();

      // Start monitor loop
      this.startMonitorLoop();

      this.isInitialized = true;
      this.logger.info(
        { current: this.currentMarket.slug, upcoming: this.upcomingMarket.slug },
        '✅ [MarketManagerService] [initialize] Market manager initialized successfully',
      );
    } catch (error) {
      this.logger.error({ error: error.message }, '🔴 [MarketManagerService] [initialize] Failed to initialize');
      throw error;
    }
  }

  /**
   * Calculate current market slug based on current timestamp
   * Format: "btc-updown-15m-{timestamp}"
   * Timestamp is rounded down to nearest multiple of 900 (15 minutes)
   */
  calculateCurrentMarketSlug(): string {
    const now = Math.floor(Date.now() / 1000); // Current time in seconds
    const currentStart = Math.floor(now / MARKET_DURATION) * MARKET_DURATION; // Round down to multiple of 900
    return `btc-updown-15m-${currentStart}`;
  }

  /**
   * Calculate next market slug based on timestamp
   * If timestamp is startTimestamp, add MARKET_DURATION to get next start
   * If timestamp is endTimestamp, use it directly as next start (since endTimestamp = startTimestamp of next market)
   */
  calculateNextMarketSlug(timestamp: number): string {
    // If timestamp is already aligned to MARKET_DURATION (endTimestamp of current market = startTimestamp of next market)
    // Just use it directly. Otherwise, round it down and add MARKET_DURATION
    const alignedTimestamp = Math.floor(timestamp / MARKET_DURATION) * MARKET_DURATION;
    
    // Check if timestamp is already a start timestamp (aligned to MARKET_DURATION)
    if (timestamp === alignedTimestamp) {
      // It's already a start timestamp, add MARKET_DURATION for next market
      return `btc-updown-15m-${timestamp + MARKET_DURATION}`;
    } else {
      // It's an endTimestamp or unaligned timestamp, use the next aligned timestamp
      return `btc-updown-15m-${alignedTimestamp + MARKET_DURATION}`;
    }
  }
  
  /**
   * Calculate market slug from timestamp directly (assumes timestamp is startTimestamp)
   */
  calculateMarketSlugFromTimestamp(timestamp: number): string {
    const alignedTimestamp = Math.floor(timestamp / MARKET_DURATION) * MARKET_DURATION;
    return `btc-updown-15m-${alignedTimestamp}`;
  }

  /**
   * Calculate previous market slug
   */
  private calculatePreviousMarketSlug(): string {
    const now = Math.floor(Date.now() / 1000);
    const currentStart = Math.floor(now / MARKET_DURATION) * MARKET_DURATION;
    const previousStart = currentStart - MARKET_DURATION;
    return `btc-updown-15m-${previousStart}`;
  }

  /**
   * Extract timestamp from market slug
   * Format: "btc-updown-15m-{timestamp}"
   */
  private extractTimestampFromSlug(slug: string): number | null {
    const match = slug.match(/-(\d+)$/);
    if (match && match[1]) {
      return parseInt(match[1], 10);
    }
    return null;
  }

  /**
   * Fetch market information by slug
   */
  private async fetchMarket(slug: string): Promise<MarketInfo | null> {
    try {
      const marketInfo = await this.gammaService.fetchMarketBySlug(slug);
      return marketInfo;
    } catch (error) {
      this.logger.error({ slug, error: error.message }, '🔴 [MarketManagerService] [fetchMarket] Error fetching market');
      return null;
    }
  }

  /**
   * Save market to registry
   * Always use timestamp from slug for index_15m calculation to ensure consistency
   */
  private async saveMarketToRegistry(market: MarketData, status: MarketStatus): Promise<void> {
    // Extract timestamp from slug to ensure consistency (slug timestamp is the source of truth)
    // This prevents duplicate index_15m when Gamma API timestamps differ from slug timestamps
    const slugStartTimestamp = this.extractTimestampFromSlug(market.slug);
    const slugEndTimestamp = slugStartTimestamp ? slugStartTimestamp + MARKET_DURATION : market.endTimestamp;
    
    // Use slug timestamp if available, otherwise fallback to Gamma API timestamp
    const startTimestamp = slugStartTimestamp || market.startTimestamp;
    const endTimestamp = slugEndTimestamp || market.endTimestamp;

    const marketData: CreateMarketRegistryData = {
      slug: market.slug,
      condition_id: market.conditionId,
      asset_yes_id: market.assetYesId,
      asset_no_id: market.assetNoId,
      start_timestamp: startTimestamp, // Use slug timestamp for consistency
      end_timestamp: endTimestamp,
      status,
      subscribed_at: new Date(),
      // Don't pass index_15m, let upsertMarket calculate it from start_timestamp (which is from slug)
    };

    await this.marketRegistry.upsertMarket(marketData);
    this.logger.debug(
      {
        slug: market.slug,
        status,
        startTimestamp,
        endTimestamp,
        slugStartTimestamp,
        gammaStartTimestamp: market.startTimestamp,
      },
      '✅ [MarketManagerService] [saveMarketToRegistry] Market saved to registry',
    );
  }

  /**
   * Subscribe to market assets
   */
  private async subscribeToMarket(market: MarketData, status: MarketStatus): Promise<void> {
    const assetIds = [market.assetYesId, market.assetNoId];
    this.wsCollector.subscribe(assetIds, market.slug, status, market.assetYesId, market.assetNoId);
    this.logger.debug({ slug: market.slug, assetIds }, '✅ [MarketManagerService] [subscribeToMarket] Subscribed to market');
  }

  /**
   * Schedule overlap subscription (15s before upcoming market starts)
   * Theo Python code: subscribe market mới TRƯỚC 15 giây khi nó bắt đầu
   */
  private scheduleOverlapSubscription(): void {
    if (this.overlapTimeout) {
      clearTimeout(this.overlapTimeout);
    }

    if (!this.currentMarket || !this.upcomingMarket) {
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    // Tính thời gian để subscribe TRƯỚC 15 giây khi upcoming market bắt đầu
    const timeUntilUpcomingStart = this.upcomingMarket.startTimestamp - now;
    const subscribeTime = timeUntilUpcomingStart - OVERLAP_BEFORE; // 15s before upcoming starts

    if (subscribeTime <= 0) {
      // Upcoming market starting soon, fetch and subscribe immediately
      this.logger.warn(
        { upcomingSlug: this.upcomingMarket.slug, timeUntilStart: timeUntilUpcomingStart },
        '⚠️ [MarketManagerService] [scheduleOverlapSubscription] Upcoming market starting soon, subscribing immediately',
      );
      this.handleOverlapSubscription();
      return;
    }

    this.logger.info(
      {
        timeUntilUpcomingStart,
        subscribeTime,
        upcomingSlug: this.upcomingMarket.slug,
        upcomingStartTimestamp: this.upcomingMarket.startTimestamp,
      },
      '🔄 [MarketManagerService] [scheduleOverlapSubscription] Scheduling overlap subscription (15s before upcoming market starts)',
    );

    this.overlapTimeout = setTimeout(() => {
      this.handleOverlapSubscription();
    }, subscribeTime * 1000); // Convert to milliseconds
  }

  /**
   * Handle overlap subscription - fetch and subscribe to next upcoming market
   */
  private async handleOverlapSubscription(): Promise<void> {
    if (!this.currentMarket || !this.upcomingMarket) {
      return;
    }

    try {
      this.logger.info('🔄 [MarketManagerService] [handleOverlapSubscription] Handling overlap subscription');

      // Fetch market C (market after upcoming market B)
      const nextSlug = this.calculateNextMarketSlug(this.upcomingMarket.startTimestamp);
      const nextMarketInfo = await this.fetchMarket(nextSlug);

      if (!nextMarketInfo) {
        this.logger.warn({ slug: nextSlug }, '⚠️ [MarketManagerService] [handleOverlapSubscription] Next market not found, will retry');
        // Retry in monitor loop
        return;
      }

      const nextMarket: MarketData = { ...nextMarketInfo, slug: nextSlug };

      // Ensure WebSocket is connected
      if (!this.wsCollector.getConnectionStatus()) {
        await this.wsCollector.connect();
        // Wait for connection to stabilize
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Subscribe to next market (C) - this is the overlap subscription
      // Keep B as upcoming (don't update this.upcomingMarket yet)
      // When A ends: B becomes current, then we'll fetch C again and it will become upcoming
      await this.subscribeToMarket(nextMarket, MarketStatus.UPCOMING);

      // Save C to registry as upcoming (for tracking purposes)
      await this.saveMarketToRegistry(nextMarket, MarketStatus.UPCOMING);

      // Don't update this.upcomingMarket here - keep B as upcoming
      // When promote happens: B becomes current, then we fetch C (which is already subscribed)
      // The promote logic will fetch C using calculateNextMarketSlug(B.startTimestamp)

      this.logger.info(
        { nextSlug, currentSlug: this.currentMarket.slug, upcomingSlug: this.upcomingMarket.slug },
        '✅ [MarketManagerService] [handleOverlapSubscription] Overlap subscription completed - C subscribed, B remains upcoming',
      );
    } catch (error) {
      this.logger.error({ error: error.message }, '🔴 [MarketManagerService] [handleOverlapSubscription] Error in overlap subscription');
    }
  }

  /**
   * Start monitor loop to check if current market has ended
   */
  private startMonitorLoop(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }

    this.logger.info('🔄 [MarketManagerService] [startMonitorLoop] Starting monitor loop');

    this.monitorInterval = setInterval(async () => {
      await this.checkAndPromoteMarkets();
    }, MONITOR_INTERVAL);
  }

  /**
   * Check if current market has ended and promote markets
   * Also retry fetching upcoming market if it's null
   */
  private async checkAndPromoteMarkets(): Promise<void> {
    if (!this.currentMarket) {
      return;
    }

    const now = Math.floor(Date.now() / 1000);

    // Retry fetching upcoming market if it's null (from previous failed fetch)
    if (!this.upcomingMarket) {
      const upcomingSlug = this.calculateNextMarketSlug(this.currentMarket.startTimestamp);
      this.logger.info({ slug: upcomingSlug }, '🔄 [MarketManagerService] [checkAndPromoteMarkets] Retrying to fetch upcoming market');
      
      const upcomingInfo = await this.fetchMarket(upcomingSlug);
      if (upcomingInfo) {
        this.upcomingMarket = { ...upcomingInfo, slug: upcomingSlug };
        await this.saveMarketToRegistry(this.upcomingMarket, MarketStatus.UPCOMING);
        await this.subscribeToMarket(this.upcomingMarket, MarketStatus.UPCOMING);
        this.logger.info({ slug: upcomingSlug }, '✅ [MarketManagerService] [checkAndPromoteMarkets] Upcoming market fetched successfully');
      } else {
        this.logger.warn({ slug: upcomingSlug }, '⚠️ [MarketManagerService] [checkAndPromoteMarkets] Failed to fetch upcoming market, will retry next cycle');
      }
    }

    // Check if current market has ended (with OVERLAP_AFTER delay)
    // Giữ market cũ 15 giây SAU khi kết thúc để không mất data
    const marketEndWithOverlap = this.currentMarket.endTimestamp + OVERLAP_AFTER;
    
    if (now >= marketEndWithOverlap) {
      this.logger.info(
        {
          currentSlug: this.currentMarket.slug,
          endTimestamp: this.currentMarket.endTimestamp,
          marketEndWithOverlap,
          now,
          overlapAfter: OVERLAP_AFTER,
        },
        '🔄 [MarketManagerService] [checkAndPromoteMarkets] Current market ended (with 15s overlap), promoting markets',
      );

      await this.promoteMarkets();
    } else if (now >= this.currentMarket.endTimestamp) {
      // Market đã kết thúc nhưng vẫn trong overlap period (15s sau khi end)
      this.logger.debug(
        {
          currentSlug: this.currentMarket.slug,
          endTimestamp: this.currentMarket.endTimestamp,
          remainingOverlap: marketEndWithOverlap - now,
        },
        '🔄 [MarketManagerService] [checkAndPromoteMarkets] Current market ended, waiting for overlap period to complete',
      );
    }
  }

  /**
   * Promote markets: upcoming becomes current, fetch new upcoming
   */
  private async promoteMarkets(): Promise<void> {
    try {
      if (!this.currentMarket || !this.upcomingMarket) {
        this.logger.warn('⚠️ [MarketManagerService] [promoteMarkets] Missing market data');
        return;
      }

      // Unsubscribe from ended market (A)
      const endedAssets = [this.currentMarket.assetYesId, this.currentMarket.assetNoId];
      this.wsCollector.unsubscribe(endedAssets);

      // Fetch closePrice for ended market (A) - fire-and-forget to avoid blocking
      // This will retry in background, won't block promote logic
      this.fetchAndSaveClosePrice(this.currentMarket).catch((error) => {
        this.logger.error(
          { slug: this.currentMarket.slug, error: error instanceof Error ? error.message : String(error) },
          '🔴 [MarketManagerService] [promoteMarkets] Error in background fetchAndSaveClosePrice',
        );
      });

      // Update database: current market ended (don't wait for closePrice)
      await this.marketRegistry.updateStatus(this.currentMarket.slug, MarketStatus.ENDED, new Date());

      // Promote upcoming market (B) to current
      const oldCurrent = this.currentMarket;
      this.currentMarket = this.upcomingMarket;
      await this.marketRegistry.updateStatus(this.currentMarket.slug, MarketStatus.ACTIVE, null);

      // Fetch openPrice for new current market when it becomes active - fire-and-forget to avoid blocking
      // This will retry in background, won't block promote logic
      this.fetchAndSaveOpenPrice(this.currentMarket).catch((error) => {
        this.logger.error(
          { slug: this.currentMarket.slug, error: error instanceof Error ? error.message : String(error) },
          '🔴 [MarketManagerService] [promoteMarkets] Error in background fetchAndSaveOpenPrice',
        );
      });

      // Fetch new upcoming market (C)
      const newUpcomingSlug = this.calculateNextMarketSlug(this.currentMarket.startTimestamp);
      this.logger.info({ slug: newUpcomingSlug }, '🔄 [MarketManagerService] [promoteMarkets] Fetching new upcoming market');
      
      const newUpcomingInfo = await this.fetchMarket(newUpcomingSlug);
      if (!newUpcomingInfo) {
        this.logger.warn({ slug: newUpcomingSlug }, '⚠️ [MarketManagerService] [promoteMarkets] New upcoming market not found, will retry');
        // Will retry in next monitor cycle
        this.upcomingMarket = null;
      } else {
        this.upcomingMarket = { ...newUpcomingInfo, slug: newUpcomingSlug };
        await this.saveMarketToRegistry(this.upcomingMarket, MarketStatus.UPCOMING);
        await this.subscribeToMarket(this.upcomingMarket, MarketStatus.UPCOMING);
      }

      // Schedule overlap subscription for new current market
      this.scheduleOverlapSubscription();

      this.logger.info(
        {
          oldCurrent: oldCurrent.slug,
          newCurrent: this.currentMarket.slug,
          newUpcoming: this.upcomingMarket?.slug || 'null',
        },
        '✅ [MarketManagerService] [promoteMarkets] Markets promoted successfully',
      );
    } catch (error) {
      this.logger.error({ error: error.message }, '🔴 [MarketManagerService] [promoteMarkets] Error promoting markets');
    }
  }

  /**
   * Stop market manager - cleanup intervals and timeouts
   */
  stop(): void {
    this.logger.info('🔄 [MarketManagerService] [stop] Stopping market manager');

    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }

    if (this.overlapTimeout) {
      clearTimeout(this.overlapTimeout);
      this.overlapTimeout = null;
    }

    this.isInitialized = false;
    this.logger.info('✅ [MarketManagerService] [stop] Market manager stopped');
  }

  /**
   * Get current market
   */
  getCurrentMarket(): MarketData | null {
    return this.currentMarket;
  }

  /**
   * Get upcoming market
   */
  getUpcomingMarket(): MarketData | null {
    return this.upcomingMarket;
  }

  /**
   * Fetch and save openPrice when market starts (becomes ACTIVE)
   * Retry with exponential backoff for 429 errors, fixed delay for other errors
   */
  private async fetchAndSaveOpenPrice(market: MarketData): Promise<void> {
    const MAX_RETRIES = 10;
    const BASE_DELAY_MS = 2000; // 2 seconds base delay for normal retries
    const MAX_DELAY_MS = 60000; // 60 seconds max delay for exponential backoff

    // Check if market already has openPrice
    const existingMarket = await this.marketRegistry.findBySlug(market.slug);
    if (existingMarket && existingMarket.open_price !== null) {
      this.logger.info(
        {
          slug: market.slug,
          existingOpenPrice: existingMarket.open_price,
          startTimestamp: market.startTimestamp,
          endTimestamp: market.endTimestamp,
        },
        '💰 [MarketManagerService] [fetchAndSaveOpenPrice] Market already has openPrice, skipping',
      );
      return;
    }

    // Extract timestamp from slug để đảm bảo consistency với slug pattern
    // Slug format: "btc-updown-15m-{timestamp}" - timestamp này là start timestamp thực tế
    const slugStartTimestamp = this.extractTimestampFromSlug(market.slug);
    const slugEndTimestamp = slugStartTimestamp ? slugStartTimestamp + MARKET_DURATION : market.endTimestamp;
    
    // Use timestamp from slug nếu có, fallback to Gamma API timestamps
    const startTimestamp = slugStartTimestamp || market.startTimestamp;
    const endTimestamp = slugEndTimestamp || market.endTimestamp;

    this.logger.info(
      {
        slug: market.slug,
        slugStartTimestamp,
        slugEndTimestamp,
        gammaStartTimestamp: market.startTimestamp,
        gammaEndTimestamp: market.endTimestamp,
        usingStartTimestamp: startTimestamp,
        usingEndTimestamp: endTimestamp,
        startDate: new Date(startTimestamp * 1000).toISOString(),
        endDate: new Date(endTimestamp * 1000).toISOString(),
        maxRetries: MAX_RETRIES,
      },
      '💰 [MarketManagerService] [fetchAndSaveOpenPrice] Fetching openPrice for market (with retry and exponential backoff)',
    );

    // Retry logic with exponential backoff for 429 errors
    let consecutiveRateLimitErrors = 0;
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const priceData = await this.cryptoPriceService.fetchCryptoPriceByMarket(
          market.slug,
          startTimestamp,
          endTimestamp,
        );

        // Reset consecutive rate limit errors on success
        consecutiveRateLimitErrors = 0;

        if (!priceData) {
          if (attempt < MAX_RETRIES) {
            // Use fixed delay for null response (not a rate limit error)
            const delayMs = BASE_DELAY_MS;
            this.logger.warn(
              { slug: market.slug, attempt, maxRetries: MAX_RETRIES, nextRetryInSeconds: delayMs / 1000 },
              `⚠️ [MarketManagerService] [fetchAndSaveOpenPrice] Failed to fetch crypto price (attempt ${attempt}/${MAX_RETRIES}), retrying in ${delayMs / 1000}s...`,
            );
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            continue;
          } else {
            this.logger.error(
              { slug: market.slug, attempts: MAX_RETRIES },
              `🔴 [MarketManagerService] [fetchAndSaveOpenPrice] Failed to fetch crypto price after ${MAX_RETRIES} attempts`,
            );
            return;
          }
        }

        // Save openPrice ONLY (closePrice will be saved when market ends)
        // Don't save closePrice here even if API returns it - only save when market status is ENDED
        await this.marketRegistry.updateCryptoPrices(
          market.slug,
          priceData.openPrice,
          undefined, // Don't update closePrice here - only when market ends
          null, // type_win will be set when market ends
        );

        this.logger.info(
          {
            slug: market.slug,
            attempt,
            openPrice: priceData.openPrice,
            apiReturnedClosePrice: priceData.closePrice,
            completed: priceData.completed,
          },
          `✅ [MarketManagerService] [fetchAndSaveOpenPrice] Successfully saved openPrice (attempt ${attempt}/${MAX_RETRIES})`,
        );
        return; // Success, exit retry loop
      } catch (error) {
        // Check if it's a rate limit error (429)
        const isRateLimit = (error as any)?.status === 429 || (error as any)?.isRateLimit === true;
        
        if (isRateLimit) {
          consecutiveRateLimitErrors++;
        } else {
          consecutiveRateLimitErrors = 0; // Reset on non-rate-limit errors
        }

        if (attempt < MAX_RETRIES) {
          // Calculate delay: exponential backoff for 429, fixed delay for other errors
          let delayMs: number;
          if (isRateLimit) {
            // Exponential backoff for rate limit: 2s, 4s, 8s, 16s, 32s, 60s (max)
            delayMs = Math.min(
              BASE_DELAY_MS * Math.pow(2, consecutiveRateLimitErrors - 1),
              MAX_DELAY_MS,
            );
          } else {
            // Fixed delay for other errors
            delayMs = BASE_DELAY_MS;
          }

          this.logger.warn(
            {
              slug: market.slug,
              attempt,
              maxRetries: MAX_RETRIES,
              error: error instanceof Error ? error.message : String(error),
              isRateLimit,
              consecutiveRateLimitErrors,
              nextRetryInSeconds: delayMs / 1000,
            },
            `⚠️ [MarketManagerService] [fetchAndSaveOpenPrice] Error fetching openPrice (attempt ${attempt}/${MAX_RETRIES}, rateLimit: ${isRateLimit}), retrying in ${delayMs / 1000}s...`,
          );
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        } else {
          this.logger.error(
            {
              slug: market.slug,
              attempts: MAX_RETRIES,
              error: error instanceof Error ? error.message : String(error),
              isRateLimit,
              consecutiveRateLimitErrors,
            },
            `🔴 [MarketManagerService] [fetchAndSaveOpenPrice] Error fetching openPrice after ${MAX_RETRIES} attempts (rateLimit: ${isRateLimit})`,
          );
          return;
        }
      }
    }
  }

  /**
   * Fetch and save closePrice and calculate type_win when market ends
   * Retry with exponential backoff for 429 errors, fixed delay for other errors
   */
  private async fetchAndSaveClosePrice(market: MarketData): Promise<void> {
    const MAX_RETRIES = 10;
    const BASE_DELAY_MS = 2000; // 2 seconds base delay for normal retries
    const MAX_DELAY_MS = 60000; // 60 seconds max delay for exponential backoff

    // Extract timestamp from slug để đảm bảo consistency với slug pattern
    const slugStartTimestamp = this.extractTimestampFromSlug(market.slug);
    const slugEndTimestamp = slugStartTimestamp ? slugStartTimestamp + MARKET_DURATION : market.endTimestamp;
    
    // Use timestamp from slug nếu có, fallback to Gamma API timestamps
    const startTimestamp = slugStartTimestamp || market.startTimestamp;
    const endTimestamp = slugEndTimestamp || market.endTimestamp;

    this.logger.info(
      {
        slug: market.slug,
        slugStartTimestamp,
        slugEndTimestamp,
        gammaStartTimestamp: market.startTimestamp,
        gammaEndTimestamp: market.endTimestamp,
        usingStartTimestamp: startTimestamp,
        usingEndTimestamp: endTimestamp,
        maxRetries: MAX_RETRIES,
      },
      '💰 [MarketManagerService] [fetchAndSaveClosePrice] Fetching closePrice for ended market (with retry and exponential backoff)',
    );

    // Retry logic with exponential backoff for 429 errors
    let consecutiveRateLimitErrors = 0;
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const priceData = await this.cryptoPriceService.fetchCryptoPriceByMarket(
          market.slug,
          startTimestamp,
          endTimestamp,
        );

        // Reset consecutive rate limit errors on success
        consecutiveRateLimitErrors = 0;

        // Check if market is completed and has closePrice
        // API might return completed: false immediately after market ended
        // We need to retry until completed: true and closePrice is available
        if (!priceData.completed || priceData.closePrice === null) {
          if (attempt < MAX_RETRIES) {
            // Use fixed delay for "not completed yet" case (not a rate limit error)
            const delayMs = BASE_DELAY_MS;
            this.logger.warn(
              {
                slug: market.slug,
                attempt,
                maxRetries: MAX_RETRIES,
                completed: priceData.completed,
                closePrice: priceData.closePrice,
                nextRetryInSeconds: delayMs / 1000,
              },
              `⚠️ [MarketManagerService] [fetchAndSaveClosePrice] Market not completed yet (completed: ${priceData.completed}, closePrice: ${priceData.closePrice}), retrying in ${delayMs / 1000}s...`,
            );
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            continue;
          } else {
            this.logger.warn(
              {
                slug: market.slug,
                attempts: MAX_RETRIES,
                completed: priceData.completed,
                closePrice: priceData.closePrice,
              },
              `⚠️ [MarketManagerService] [fetchAndSaveClosePrice] Market still not completed after ${MAX_RETRIES} attempts, will retry later via scheduled task`,
            );
            // Don't save null closePrice - let scheduled task retry later
            return;
          }
        }

        // Market is completed and has closePrice - save it
        // Get existing market data to check if we already have openPrice
        const existingMarket = await this.marketRegistry.findBySlug(market.slug);
        const openPrice = existingMarket?.open_price ?? priceData.openPrice;

        // Calculate type_win: UP if openPrice < closePrice, DOWN otherwise
        let typeWin: 'UP' | 'DOWN' | null = null;
        if (priceData.completed && priceData.closePrice !== null && openPrice !== null) {
          typeWin = openPrice < priceData.closePrice ? MarketWinType.UP : MarketWinType.DOWN;
        }

        // Update with closePrice and type_win
        // If we don't have openPrice yet, save it too
        await this.marketRegistry.updateCryptoPrices(
          market.slug,
          openPrice !== existingMarket?.open_price ? openPrice : undefined,
          priceData.closePrice, // Now we know it's not null
          typeWin,
        );

        this.logger.info(
          {
            slug: market.slug,
            attempt,
            openPrice,
            closePrice: priceData.closePrice,
            typeWin,
            completed: priceData.completed,
          },
          `✅ [MarketManagerService] [fetchAndSaveClosePrice] Successfully saved closePrice and type_win (attempt ${attempt}/${MAX_RETRIES})`,
        );
        return; // Success, exit retry loop
      } catch (error) {
        // Check if it's a rate limit error (429)
        const isRateLimit = (error as any)?.status === 429 || (error as any)?.isRateLimit === true;
        
        if (isRateLimit) {
          consecutiveRateLimitErrors++;
        } else {
          consecutiveRateLimitErrors = 0; // Reset on non-rate-limit errors
        }

        if (attempt < MAX_RETRIES) {
          // Calculate delay: exponential backoff for 429, fixed delay for other errors
          let delayMs: number;
          if (isRateLimit) {
            // Exponential backoff for rate limit: 2s, 4s, 8s, 16s, 32s, 60s (max)
            delayMs = Math.min(
              BASE_DELAY_MS * Math.pow(2, consecutiveRateLimitErrors - 1),
              MAX_DELAY_MS,
            );
          } else {
            // Fixed delay for other errors
            delayMs = BASE_DELAY_MS;
          }

          this.logger.warn(
            {
              slug: market.slug,
              attempt,
              maxRetries: MAX_RETRIES,
              error: error instanceof Error ? error.message : String(error),
              isRateLimit,
              consecutiveRateLimitErrors,
              nextRetryInSeconds: delayMs / 1000,
            },
            `⚠️ [MarketManagerService] [fetchAndSaveClosePrice] Error fetching closePrice (attempt ${attempt}/${MAX_RETRIES}, rateLimit: ${isRateLimit}), retrying in ${delayMs / 1000}s...`,
          );
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        } else {
          this.logger.error(
            {
              slug: market.slug,
              attempts: MAX_RETRIES,
              error: error instanceof Error ? error.message : String(error),
              isRateLimit,
              consecutiveRateLimitErrors,
            },
            `🔴 [MarketManagerService] [fetchAndSaveClosePrice] Error fetching closePrice after ${MAX_RETRIES} attempts (rateLimit: ${isRateLimit})`,
          );
          return;
        }
      }
    }
  }

  /**
   * Retry fetching closePrice for ended markets that are missing close_price or type_win
   * This can be called periodically to fill in missing data
   */
  async retryFetchClosePriceForEndedMarkets(): Promise<void> {
    try {
      const endedMarkets = await this.marketRegistry.findEndedMarketsNeedingUpdate();

      if (endedMarkets.length === 0) {
        // this.logger.info('✅ [MarketManagerService] [retryFetchClosePriceForEndedMarkets] No ended markets needing update');
        return;
      }

      this.logger.info(
        { count: endedMarkets.length },
        `🔄 [MarketManagerService] [retryFetchClosePriceForEndedMarkets] Found ${endedMarkets.length} ended markets missing closePrice`,
      );

      // Process markets with fire-and-forget to avoid blocking scheduled task
      // Each market will retry in background with its own exponential backoff
      // Rate limiting: schedule each market with 2 seconds delay to avoid 429 errors
      const MIN_DELAY_BETWEEN_MARKETS_MS = 2000; // 2 seconds

      for (let i = 0; i < endedMarkets.length; i++) {
        const market = endedMarkets[i];
        
        // Convert entity to MarketData format for fetchAndSaveClosePrice
        const marketData: MarketData = {
          slug: market.slug,
          conditionId: market.condition_id,
          assetYesId: market.asset_yes_id,
          assetNoId: market.asset_no_id,
          startTimestamp: market.start_timestamp,
          endTimestamp: market.end_timestamp,
        };

        // Schedule each market with delay to avoid rate limiting
        // Fire-and-forget: each market retries in background, won't block scheduled task
        const delayMs = i * MIN_DELAY_BETWEEN_MARKETS_MS;
        
        setTimeout(() => {
          this.fetchAndSaveClosePrice(marketData).catch((error) => {
            this.logger.error(
              { slug: market.slug, error: error instanceof Error ? error.message : String(error) },
              '🔴 [MarketManagerService] [retryFetchClosePriceForEndedMarkets] Error in background fetchAndSaveClosePrice',
            );
          });
        }, delayMs);
      }

      this.logger.info(
        {
          count: endedMarkets.length,
          totalDelaySeconds: (endedMarkets.length - 1) * (MIN_DELAY_BETWEEN_MARKETS_MS / 1000),
        },
        `✅ [MarketManagerService] [retryFetchClosePriceForEndedMarkets] Scheduled ${endedMarkets.length} markets for processing in background`,
      );

      this.logger.info(
        { processed: endedMarkets.length },
        `✅ [MarketManagerService] [retryFetchClosePriceForEndedMarkets] Completed processing ${endedMarkets.length} markets`,
      );
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        '🔴 [MarketManagerService] [retryFetchClosePriceForEndedMarkets] Error in retry process',
      );
    }
  }

  /**
   * Cleanup on module destroy
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.info('🔄 [MarketManagerService] [onModuleDestroy] Cleaning up');
    this.stop();
  }
}

