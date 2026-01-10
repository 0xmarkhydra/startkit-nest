import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { MarketPriceChangeRepository, BatchInsertPriceChange } from '@/database/repositories/market-price-change.repository';
import { BATCH_INTERVAL, BATCH_SIZE, MAX_QUEUE_SIZE } from '@/shared/constants/polymarket.constants';

@Injectable()
export class MarketPriceChangeBatchService implements OnModuleDestroy {
  private priceChangeQueue: BatchInsertPriceChange[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private isProcessing: boolean = false;

  constructor(
    private readonly priceChangeRepository: MarketPriceChangeRepository,
    @InjectPinoLogger(MarketPriceChangeBatchService.name) private readonly logger: PinoLogger,
  ) {}

  /**
   * Save price change record to queue for batch insert
   */
  async savePriceChange(priceChange: BatchInsertPriceChange): Promise<void> {
    // Check queue size limit to prevent overflow
    if (this.priceChangeQueue.length >= MAX_QUEUE_SIZE) {
      this.logger.error(
        { queueSize: this.priceChangeQueue.length },
        '🔴 [MarketPriceChangeBatchService] [savePriceChange] Queue overflow, dropping price change',
      );
      return;
    }

    this.priceChangeQueue.push(priceChange);

    // If queue reaches BATCH_SIZE, process immediately
    if (this.priceChangeQueue.length >= BATCH_SIZE) {
      this.logger.debug(
        { queueSize: this.priceChangeQueue.length },
        '🔄 [MarketPriceChangeBatchService] [savePriceChange] Queue reached BATCH_SIZE, processing immediately',
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
   * Process batch of price changes and insert into database
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

    if (this.priceChangeQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      const priceChangesToProcess = this.priceChangeQueue.splice(0, BATCH_SIZE);

      if (priceChangesToProcess.length > 0) {
        await this.priceChangeRepository.batchInsert(priceChangesToProcess);

        this.logger.debug(
          { count: priceChangesToProcess.length },
          `✅ [MarketPriceChangeBatchService] [processBatch] Inserted ${priceChangesToProcess.length} price changes`,
        );
      }
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : String(error), count: this.priceChangeQueue.length },
        '🔴 [MarketPriceChangeBatchService] [processBatch] Error inserting price changes',
      );
      // Don't re-queue failed price changes to avoid infinite loops
      // In production, you might want to implement a retry mechanism or dead letter queue
    } finally {
      this.isProcessing = false;

      // If there are more price changes in queue, process next batch
      if (this.priceChangeQueue.length > 0) {
        if (this.priceChangeQueue.length >= BATCH_SIZE) {
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
   * Flush remaining price changes in queue
   */
  async flushQueue(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    if (this.priceChangeQueue.length > 0) {
      this.logger.info(
        { count: this.priceChangeQueue.length },
        '🔄 [MarketPriceChangeBatchService] [flushQueue] Flushing remaining price changes in queue',
      );
      await this.processBatch(); // Process all remaining messages
    }
  }

  /**
   * Cleanup on module destroy
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.info('🔄 [MarketPriceChangeBatchService] [onModuleDestroy] Cleaning up');
    await this.flushQueue();
  }
}

