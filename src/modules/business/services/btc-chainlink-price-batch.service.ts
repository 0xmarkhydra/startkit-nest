import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { BtcChainlinkPriceRepository, BatchInsertPrice } from '@/database/repositories/btc-chainlink-price.repository';
import { PRICE_BATCH_INTERVAL, PRICE_BATCH_SIZE, MAX_QUEUE_SIZE } from '@/shared/constants/polymarket.constants';

@Injectable()
export class BtcChainlinkPriceBatchService implements OnModuleDestroy {
  private priceQueue: BatchInsertPrice[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private isProcessing: boolean = false;

  constructor(
    private readonly priceRepository: BtcChainlinkPriceRepository,
    @InjectPinoLogger(BtcChainlinkPriceBatchService.name) private readonly logger: PinoLogger,
  ) {}

  /**
   * Save price record to queue for batch insert
   */
  async savePrice(timestamp: Date, symbol: string, price: number): Promise<void> {
    // Check queue size limit to prevent overflow
    if (this.priceQueue.length >= MAX_QUEUE_SIZE) {
      this.logger.error(
        { queueSize: this.priceQueue.length },
        '🔴 [BtcChainlinkPriceBatchService] [savePrice] Queue overflow, dropping price',
      );
      return;
    }

    this.priceQueue.push({
      timestamp,
      symbol,
      price,
    });

    // If queue reaches BATCH_SIZE, process immediately
    if (this.priceQueue.length >= PRICE_BATCH_SIZE) {
      this.logger.debug(
        { queueSize: this.priceQueue.length },
        '🔄 [BtcChainlinkPriceBatchService] [savePrice] Queue reached BATCH_SIZE, processing immediately',
      );
      await this.processBatch();
    } else if (!this.batchTimer) {
      // Set timer to process batch after PRICE_BATCH_INTERVAL
      this.batchTimer = setTimeout(() => {
        this.processBatch();
      }, PRICE_BATCH_INTERVAL);
    }
  }

  /**
   * Process batch of prices and insert into database
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

    if (this.priceQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      const pricesToProcess = this.priceQueue.splice(0, PRICE_BATCH_SIZE);

      if (pricesToProcess.length > 0) {
        await this.priceRepository.batchInsert(pricesToProcess);

        this.logger.debug(
          { count: pricesToProcess.length },
          `✅ [BtcChainlinkPriceBatchService] [processBatch] Inserted ${pricesToProcess.length} prices`,
        );
      }
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : String(error), count: this.priceQueue.length },
        '🔴 [BtcChainlinkPriceBatchService] [processBatch] Error inserting prices',
      );
      // Don't re-queue failed prices to avoid infinite loops
      // In production, you might want to implement a retry mechanism or dead letter queue
    } finally {
      this.isProcessing = false;

      // If there are more prices in queue, process next batch
      if (this.priceQueue.length > 0) {
        if (this.priceQueue.length >= PRICE_BATCH_SIZE) {
          // Process immediately if queue is full
          await this.processBatch();
        } else {
          // Set timer for next batch
          this.batchTimer = setTimeout(() => {
            this.processBatch();
          }, PRICE_BATCH_INTERVAL);
        }
      }
    }
  }

  /**
   * Flush remaining prices in queue
   */
  async flushQueue(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    if (this.priceQueue.length > 0) {
      this.logger.info(
        { count: this.priceQueue.length },
        '🔄 [BtcChainlinkPriceBatchService] [flushQueue] Flushing remaining prices in queue',
      );
      await this.processBatch(); // Process all remaining messages
    }
  }

  /**
   * Cleanup on module destroy
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.info('🔄 [BtcChainlinkPriceBatchService] [onModuleDestroy] Cleaning up');
    await this.flushQueue();
  }
}

