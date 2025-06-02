import { Entity, Column } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from './base.entity';

@Entity('trading_pairs')
export class TradingPair extends BaseEntity {
  @ApiProperty({
    description: 'Mã cặp tiền tệ',
    example: 'BTC/USDT'
  })
  @Column({ length: 20 })
  symbol: string;

  @ApiProperty({
    description: 'Trạng thái hoạt động',
    example: true
  })
  @Column({ name: 'is_active', default: true })
  is_active: boolean;
}
