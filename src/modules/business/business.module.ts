import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { Trade } from '../database/entities/trade.entity';
import { TradeService } from './services/trade.service';
import { TelegramService } from './services/telegram.service';
import { BinanceTradeService } from './services/binance-trade.service';
import { TradingPair } from '../database/entities/trading-pair.entity';
import { TradingPairService } from './services/trading-pair.service';
import { OpenAIService } from './services/openai.service';

// Import commands
import { TradeCommands, TestTelegramCommand, TestBinanceCommand } from './commands/trade.commands';

// Services
const services = [
  OpenAIService,
  TradeService,
  TelegramService,
  BinanceTradeService,
  TradingPairService,
];

// Commands
const commands = [
  TradeCommands,
  TestTelegramCommand,
  TestBinanceCommand,
];

@Module({
  imports: [
    DatabaseModule,
    ConfigModule.forRoot(),
    TypeOrmModule.forFeature([Trade, TradingPair]),
  ],
  providers: [
    ...services,
    ...commands,
    {
      provide: 'TELEGRAM_BOT_TOKEN',
      useValue: process.env.TELEGRAM_BOT_TOKEN || '',
    },
    {
      provide: 'TELEGRAM_CHAT_ID',
      useValue: process.env.TELEGRAM_CHAT_ID || '',
    },
  ],
  exports: [...services, ...commands],
})
export class BusinessModule {}
