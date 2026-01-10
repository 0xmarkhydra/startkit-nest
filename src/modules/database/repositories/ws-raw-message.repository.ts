import { DataSource, Repository } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { WsRawMessageEntity } from '../entities/ws-raw-message.entity';
import { WebSocketEventType, MarketStatus } from '@/shared/constants/polymarket.constants';

export interface BatchInsertMessage {
  market_slug: string | null;
  asset_id: string | null;
  event_type: WebSocketEventType | string;
  market_status: MarketStatus | string | null;
  raw_data: Record<string, any>;
  received_at: Date;
}

export class WsRawMessageRepository extends Repository<WsRawMessageEntity> {
  constructor(@InjectDataSource() private dataSource: DataSource) {
    super(WsRawMessageEntity, dataSource.createEntityManager());
  }

  /**
   * Batch insert multiple raw messages efficiently
   * @param messages Array of messages to insert
   */
  async batchInsert(messages: BatchInsertMessage[]): Promise<void> {
    if (messages.length === 0) {
      return;
    }

    // Create entities from messages
    const entities = messages.map((msg) =>
      this.create({
        market_slug: msg.market_slug,
        asset_id: msg.asset_id,
        event_type: (msg.event_type as WebSocketEventType) || WebSocketEventType.UNKNOWN,
        market_status: (msg.market_status as MarketStatus) || null,
        raw_data: msg.raw_data,
        received_at: msg.received_at,
      }),
    );

    // Use save() which handles batch insert internally
    // TypeORM's save() method will batch insert when given an array
    await this.save(entities);
  }
}

