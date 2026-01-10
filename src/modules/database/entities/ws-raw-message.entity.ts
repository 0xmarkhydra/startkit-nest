import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { WebSocketEventType, MarketStatus } from '@/shared/constants/polymarket.constants';

@Entity('ws_raw_messages')
export class WsRawMessageEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 255, nullable: true })
  @Index('idx_ws_raw_market')
  market_slug: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  @Index('idx_ws_raw_asset')
  asset_id: string | null;

  @Column({ type: 'varchar', length: 50, default: WebSocketEventType.UNKNOWN })
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

