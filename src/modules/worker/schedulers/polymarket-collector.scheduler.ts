import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Cron } from '@nestjs/schedule';
import { MarketManagerService } from '@/business/services/market-manager.service';
import { PolymarketWebSocketCollectorService } from '@/business/services/polymarket-websocket-collector.service';
import { RawMessageBatchService } from '@/business/services/raw-message-batch.service';
import { WsRawMessageRepository } from '@/database/repositories/ws-raw-message.repository';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DATA_RETENTION_DAYS, CLEANUP_CRON_EXPRESSION } from '@/shared/constants/polymarket.constants';

@Injectable()
export class PolymarketCollectorScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly isWorker: boolean;

  private wsRawMessageRepo: WsRawMessageRepository;

  constructor(
    private readonly marketManager: MarketManagerService,
    private readonly wsCollector: PolymarketWebSocketCollectorService,
    private readonly batchService: RawMessageBatchService,
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectPinoLogger(PolymarketCollectorScheduler.name) private readonly logger: PinoLogger,
  ) {
    // Only run when IS_WORKER=1
    this.isWorker = Boolean(Number(process.env.IS_WORKER || 0));
    // Initialize repository with DataSource
    this.wsRawMessageRepo = new WsRawMessageRepository(this.dataSource);
  }

  /**
   * Initialize collector on module init
   */
  async onModuleInit(): Promise<void> {
    if (!this.isWorker) {
      this.logger.info('ℹ️ [PolymarketCollectorScheduler] [onModuleInit] IS_WORKER is not set, skipping collector initialization');
      return;
    }

    try {
      this.logger.info('🔄 [PolymarketCollectorScheduler] [onModuleInit] Initializing Polymarket collector');

      // Initialize market manager (this will connect WebSocket, fetch markets, subscribe, and start monitoring)
      await this.marketManager.initialize();

      this.logger.info('✅ [PolymarketCollectorScheduler] [onModuleInit] Polymarket collector initialized successfully');
    } catch (error) {
      this.logger.error(
        { error: error.message },
        '🔴 [PolymarketCollectorScheduler] [onModuleInit] Failed to initialize collector',
      );
      // Don't throw - let the application continue running, will retry in next cycle
    }
  }

  /**
   * Graceful shutdown on module destroy
   */
  async onModuleDestroy(): Promise<void> {
    if (!this.isWorker) {
      return;
    }

    try {
      this.logger.info('🔄 [PolymarketCollectorScheduler] [onModuleDestroy] Shutting down Polymarket collector');

      // Stop market manager (stops monitor loop and overlap subscription)
      this.marketManager.stop();

      // Disconnect WebSocket
      await this.wsCollector.disconnect();

      // Flush message queue to ensure no data loss
      await this.batchService.flushQueue();

      this.logger.info('✅ [PolymarketCollectorScheduler] [onModuleDestroy] Polymarket collector shutdown completed');
    } catch (error) {
      this.logger.error(
        { error: error.message },
        '🔴 [PolymarketCollectorScheduler] [onModuleDestroy] Error during shutdown',
      );
    }
  }

  /**
   * Cleanup old messages older than specified days (default: 2 days)
   * Runs daily at 2:00 AM UTC
   * Can be configured via WS_RAW_MESSAGE_RETENTION_DAYS env variable
   */
  @Cron(CLEANUP_CRON_EXPRESSION, {
    name: 'cleanup-old-messages',
    timeZone: 'UTC',
  })
  async cleanupOldMessages(): Promise<void> {
    if (!this.isWorker) {
      return;
    }

    try {
      // Get retention days from env variable or use default
      const retentionDays = Number(process.env.WS_RAW_MESSAGE_RETENTION_DAYS) || DATA_RETENTION_DAYS;

      this.logger.info(
        { retentionDays },
        `🧹 [PolymarketCollectorScheduler] [cleanupOldMessages] Starting cleanup of old messages (> ${retentionDays} days)`,
      );

      const deletedCount = await this.wsRawMessageRepo.deleteOldMessages(retentionDays);

      this.logger.info(
        { deletedCount, retentionDays },
        `✅ [PolymarketCollectorScheduler] [cleanupOldMessages] Cleanup completed. Deleted ${deletedCount} old messages (older than ${retentionDays} days)`,
      );
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        '🔴 [PolymarketCollectorScheduler] [cleanupOldMessages] Error during cleanup',
      );
    }
  }

  /**
   * Retry fetching closePrice for ended markets missing close_price
   * Runs every 1 minute to fill in missing data
   * Finds markets with status = 'ended' and close_price = null
   */
  @Cron('* * * * *', {
    name: 'retry-ended-markets-close-price',
    timeZone: 'UTC',
  })
  async retryEndedMarketsClosePrice(): Promise<void> {
    if (!this.isWorker) {
      return;
    }

    try {
      this.logger.debug('🔄 [PolymarketCollectorScheduler] [retryEndedMarketsClosePrice] Starting retry for ended markets missing closePrice');

      await this.marketManager.retryFetchClosePriceForEndedMarkets();

      this.logger.debug('✅ [PolymarketCollectorScheduler] [retryEndedMarketsClosePrice] Completed retry for ended markets');
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        '🔴 [PolymarketCollectorScheduler] [retryEndedMarketsClosePrice] Error during retry',
      );
    }
  }
}

