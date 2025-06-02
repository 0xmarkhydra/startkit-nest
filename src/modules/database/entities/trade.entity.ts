import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';
import { ApiProperty } from '@nestjs/swagger';

export enum TradeSide {
  BUY = 'buy',
  SELL = 'sell'
}

export enum TradeStatus {
  OPEN = 'open',
  CLOSED = 'closed',
  CANCELED = 'canceled'
}

@Entity('trades')
export class Trade extends BaseEntity  {
  @ApiProperty({
    description: 'Mã cặp tiền tệ',
    example: 'BTC/USDT'
  })
  @Column()
  symbol: string;

  @ApiProperty({
    description: 'Hướng giao dịch (mua/bán)',
    example: 'buy',
    enum: TradeSide
  })
  @Column({ type: 'enum', enum: TradeSide })
  side: TradeSide;

  @ApiProperty({
    description: 'Giá vào lệnh',
    example: 50000.25
  })
  @Column({ name: 'entry_price', type: 'decimal', precision: 25, scale: 8 })
  entry_price: number;

  @ApiProperty({
    description: 'Giá thoát lệnh',
    example: 52000.75,
    nullable: true
  })
  @Column({ name: 'exit_price', type: 'decimal', precision: 25, scale: 8, nullable: true })
  exit_price: number;

  @ApiProperty({
    description: 'Khối lượng',
    example: 0.1
  })
  @Column({ type: 'decimal', precision: 25, scale: 8 })
  quantity: number;

  @ApiProperty({
    description: 'Mức cắt lỗ',
    example: 49000.50,
    nullable: true
  })
  @Column({ name: 'stop_loss', type: 'decimal', precision: 25, scale: 8, nullable: true })
  stop_loss: number;

  @ApiProperty({
    description: 'Mức chốt lãi',
    example: 55000.00,
    nullable: true
  })
  @Column({ name: 'take_profit', type: 'decimal', precision: 25, scale: 8, nullable: true })
  take_profit: number;

  @ApiProperty({
    description: 'Trạng thái giao dịch',
    example: 'open',
    enum: TradeStatus
  })
  @Column({ type: 'enum', enum: TradeStatus, default: TradeStatus.OPEN })
  status: TradeStatus;

  @ApiProperty({
    description: 'Lý do đóng lệnh',
    example: 'Hit take profit',
    nullable: true
  })
  @Column({ nullable: true })
  reason: string;

  @ApiProperty({
    description: 'Chỉ số kỹ thuật khi vào lệnh',
    example: { rsi: 30, macd: -0.5 },
    nullable: true
  })
  @Column({ name: 'indicators', type: 'jsonb', nullable: true })
  indicators: Record<string, any>;
}
