import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { OpenAIService } from './services/openai.service';
import {
  PolymarketGammaService,
  RawMessageBatchService,
  PolymarketWebSocketCollectorService,
  MarketManagerService,
} from './services';
import { PolymarketCryptoPriceService } from './services/polymarket-crypto-price.service';
import { ConfigModule } from '@nestjs/config';

const services = [
  OpenAIService,
  PolymarketGammaService,
  PolymarketCryptoPriceService,
  RawMessageBatchService,
  PolymarketWebSocketCollectorService,
  MarketManagerService,
];

@Module({
  imports: [DatabaseModule, ConfigModule],
  exports: [...services],
  providers: [...services],
})
export class BusinessModule {}
