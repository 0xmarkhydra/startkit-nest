import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { MarketTradeRepository, BatchInsertTrade } from '@/database/repositories/market-trade.repository';
import { BATCH_SIZE, BATCH_INTERVAL, MAX_QUEUE_SIZE } from '@/shared/constants/polymarket.constants';

@Injectable()
export class MarketTradeBatchService implements OnModuleDestroy {
  private tradeQueue: BatchInsertTrade[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private isProcessing: boolean = false;

  constructor(
    private readonly tradeRepository: MarketTradeRepository,
    @InjectPinoLogger(MarketTradeBatchService.name) private readonly logger: PinoLogger,
  ) {}

  /**
   * Save trade to queue for batch insert
   */
  async saveTrade(trade: BatchInsertTrade): Promise<void> {
    // Check queue size limit to prevent overflow
    if (this.tradeQueue.length >= MAX_QUEUE_SIZE) {
      this.logger.error(
        { queueSize: this.tradeQueue.length },
        '🔴 [MarketTradeBatchService] [saveTrade] Queue overflow, dropping trade',
      );
      return;
    }

    this.tradeQueue.push(trade);

    // If queue reaches BATCH_SIZE, process immediately
    if (this.tradeQueue.length >= BATCH_SIZE) {
      this.logger.debug(
        { queueSize: this.tradeQueue.length },
        '🔄 [MarketTradeBatchService] [saveTrade] Queue reached BATCH_SIZE, processing immediately',
      );
      await this.processBatch();
    } else if (!this.batchTimer) {
      // Set timer to process batch after BATCH_INTERVAL
      this.batchTimer = setTimeout(() => {
        this.processBatch();
      }, BATCH_INTERVAL);
    }
  }

  /**
   * Process batch of trades and insert into database
   */
  private async processBatch(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    // Clear timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    if (this.tradeQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      const tradesToProcess = this.tradeQueue.splice(0, BATCH_SIZE);

      if (tradesToProcess.length > 0) {
        await this.tradeRepository.batchInsert(tradesToProcess);

        this.logger.debug(
          { count: tradesToProcess.length },
          `✅ [MarketTradeBatchService] [processBatch] Inserted ${tradesToProcess.length} trades`,
        );
      }
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : String(error), count: this.tradeQueue.length },
        '🔴 [MarketTradeBatchService] [processBatch] Error inserting trades',
      );
      // Don't re-queue failed trades to avoid infinite loops
      // In production, you might want to implement a retry mechanism or dead letter queue
    } finally {
      this.isProcessing = false;

      // If there are more trades in queue, process next batch
      if (this.tradeQueue.length > 0) {
        if (this.tradeQueue.length >= BATCH_SIZE) {
          // Process immediately if queue is full
          await this.processBatch();
        } else {
          // Set timer for next batch
          this.batchTimer = setTimeout(() => {
            this.processBatch();
          }, BATCH_INTERVAL);
        }
      }
    }
  }

  /**
   * Flush remaining trades in queue
   */
  async flushQueue(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    if (this.tradeQueue.length > 0) {
      this.logger.info(
        { count: this.tradeQueue.length },
        '🔄 [MarketTradeBatchService] [flushQueue] Flushing remaining trades',
      );
      await this.processBatch();
    }
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.tradeQueue.length;
  }

  /**
   * Cleanup on module destroy
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.info('🔄 [MarketTradeBatchService] [onModuleDestroy] Cleaning up');
    await this.flushQueue();
  }
}

