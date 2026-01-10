import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { WsRawMessageRepository, BatchInsertMessage } from '@/database/repositories/ws-raw-message.repository';
import { BATCH_SIZE, BATCH_INTERVAL, MAX_QUEUE_SIZE } from '@/shared/constants/polymarket.constants';

@Injectable()
export class RawMessageBatchService implements OnModuleDestroy {
  private messageQueue: BatchInsertMessage[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private isProcessing: boolean = false;

  constructor(
    private readonly wsRawMessageRepository: WsRawMessageRepository,
    @InjectPinoLogger(RawMessageBatchService.name) private readonly logger: PinoLogger,
  ) {}

  /**
   * Save raw message to queue for batch insert
   */
  async saveRawMessage(
    marketSlug: string | null,
    assetId: string | null,
    eventType: string,
    marketStatus: string | null,
    rawData: Record<string, any>,
  ): Promise<void> {
    // Check queue size limit to prevent overflow
    if (this.messageQueue.length >= MAX_QUEUE_SIZE) {
      this.logger.error(
        { queueSize: this.messageQueue.length },
        '🔴 [RawMessageBatchService] [saveRawMessage] Queue overflow, dropping message',
      );
      return;
    }

    const message: BatchInsertMessage = {
      market_slug: marketSlug,
      asset_id: assetId,
      event_type: eventType,
      market_status: marketStatus,
      raw_data: rawData,
      received_at: new Date(),
    };

    this.messageQueue.push(message);

    // If queue reaches BATCH_SIZE, process immediately
    if (this.messageQueue.length >= BATCH_SIZE) {
      this.logger.debug(
        { queueSize: this.messageQueue.length },
        '🔄 [RawMessageBatchService] [saveRawMessage] Queue reached BATCH_SIZE, processing immediately',
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
   * Process batch of messages and insert into database
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

    if (this.messageQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    // Take up to BATCH_SIZE messages from queue
    const batch = this.messageQueue.splice(0, BATCH_SIZE);
    const batchSize = batch.length;

    if (batchSize === 0) {
      this.isProcessing = false;
      return;
    }

    try {
      this.logger.debug(
        { batchSize, remainingInQueue: this.messageQueue.length },
        '🔄 [RawMessageBatchService] [processBatch] Processing batch',
      );

      // Batch insert into database
      await this.wsRawMessageRepository.batchInsert(batch);

      // this.logger.info(
      //   { batchSize, remainingInQueue: this.messageQueue.length },
      //   '✅ [RawMessageBatchService] [processBatch] Batch inserted successfully',
      // );

      // If there are more messages in queue, process again after interval
      if (this.messageQueue.length > 0) {
        this.batchTimer = setTimeout(() => {
          this.processBatch();
        }, BATCH_INTERVAL);
      }
    } catch (error) {
      this.logger.error(
        { error: error.message, batchSize: batch.length, queueSize: this.messageQueue.length },
        '🔴 [RawMessageBatchService] [processBatch] Error inserting batch',
      );

      // If queue is not too large, put messages back for retry
      if (this.messageQueue.length < MAX_QUEUE_SIZE) {
        // Put failed batch back at the front of queue
        this.messageQueue.unshift(...batch);
        this.logger.warn(
          { queueSize: this.messageQueue.length },
          '⚠️ [RawMessageBatchService] [processBatch] Messages returned to queue for retry',
        );
      } else {
        // Queue is full, drop messages
        this.logger.error(
          { droppedCount: batch.length },
          '🔴 [RawMessageBatchService] [processBatch] Queue overflow, dropping failed batch',
        );
      }

      // Retry after interval
      if (this.messageQueue.length > 0) {
        this.batchTimer = setTimeout(() => {
          this.processBatch();
        }, BATCH_INTERVAL);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Flush all remaining messages in queue (for shutdown)
   */
  async flushQueue(): Promise<void> {
    this.logger.info({ queueSize: this.messageQueue.length }, '🔄 [RawMessageBatchService] [flushQueue] Flushing queue');

    // Clear timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    // Process all remaining messages
    while (this.messageQueue.length > 0 && !this.isProcessing) {
      await this.processBatch();
    }

    this.logger.info({ queueSize: this.messageQueue.length }, '✅ [RawMessageBatchService] [flushQueue] Queue flushed');
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.messageQueue.length;
  }

  /**
   * Cleanup on module destroy
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.info('🔄 [RawMessageBatchService] [onModuleDestroy] Cleaning up');
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    // Flush remaining messages
    await this.flushQueue();
  }
}

