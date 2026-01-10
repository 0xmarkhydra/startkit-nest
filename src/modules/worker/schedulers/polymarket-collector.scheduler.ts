import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { MarketManagerService } from '@/business/services/market-manager.service';
import { PolymarketWebSocketCollectorService } from '@/business/services/polymarket-websocket-collector.service';
import { RawMessageBatchService } from '@/business/services/raw-message-batch.service';

@Injectable()
export class PolymarketCollectorScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly isWorker: boolean;

  constructor(
    private readonly marketManager: MarketManagerService,
    private readonly wsCollector: PolymarketWebSocketCollectorService,
    private readonly batchService: RawMessageBatchService,
    @InjectPinoLogger(PolymarketCollectorScheduler.name) private readonly logger: PinoLogger,
  ) {
    // Only run when IS_WORKER=1
    this.isWorker = Boolean(Number(process.env.IS_WORKER || 0));
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
}

