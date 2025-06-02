import { ApiProperty } from '@nestjs/swagger';

export class TradingPairResponseDto {
  @ApiProperty({
    description: 'Unique identifier of the trading pair',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  id: string;

  @ApiProperty({
    description: 'Trading pair symbol (e.g., BTC/USDT)',
    example: 'BTC/USDT'
  })
  symbol: string;

  @ApiProperty({
    description: 'Whether this trading pair is active for trading',
    example: true
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Timeframe for technical analysis',
    example: '1h'
  })
  timeframe: string;

  @ApiProperty({
    description: 'RSI period for technical analysis',
    example: 14
  })
  rsiPeriod: number;

  @ApiProperty({
    description: 'RSI overbought threshold',
    example: 70
  })
  rsiOverbought: number;

  @ApiProperty({
    description: 'RSI oversold threshold',
    example: 30
  })
  rsiOversold: number;

  @ApiProperty({
    description: 'Default position size for this trading pair',
    example: 0.001
  })
  positionSize: number;

  @ApiProperty({
    description: 'Risk percentage per trade',
    example: 1
  })
  riskPerTrade: number;

  @ApiProperty({
    description: 'ATR multiplier for stop loss calculation',
    example: 2
  })
  atrMultiplier: number;

  @ApiProperty({
    description: 'Take profit ratio relative to stop loss',
    example: 2
  })
  takeProfitRatio: number;

  @ApiProperty({
    description: 'Whether to use ATR for stop loss calculation',
    example: true
  })
  useAtrForStopLoss: boolean;

  @ApiProperty({
    description: 'Additional settings in JSON format',
    example: { trailingStop: false, maxDrawdown: 0.05 },
    nullable: true
  })
  additionalSettings: Record<string, any> | null;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2025-06-02T10:00:00.000Z'
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2025-06-02T10:00:00.000Z'
  })
  updatedAt: Date;
}
