import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { WebSocketEventType, MarketStatus } from '@/shared/constants/polymarket.constants';

@Entity('ws_raw_messages')
@Index('idx_ws_raw_market_received', ['market_slug', 'received_at'])
@Index('idx_ws_raw_asset_received', ['asset_id', 'received_at'])
@Index('idx_ws_raw_event_received', ['event_type', 'received_at'])
@Index('idx_ws_raw_status_received', ['market_status', 'received_at'])
export class WsRawMessageEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 255, nullable: true })
  @Index('idx_ws_raw_market')
  market_slug: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  @Index('idx_ws_raw_asset')
  asset_id: string | null;

  @Column({ type: 'varchar', length: 50, default: WebSocketEventType.UNKNOWN })
  @Index('idx_ws_raw_event')
  event_type: WebSocketEventType;

  @Column({ type: 'varchar', length: 20, nullable: true })
  @Index('idx_ws_raw_status')
  market_status: MarketStatus | null;

  @Column({ type: 'jsonb' })
  raw_data: Record<string, any>;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  @Index('idx_ws_raw_received', { unique: false })
  received_at: Date;
}

