import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { OpenAIService } from './services/openai.service';
import {
  PolymarketGammaService,
  RawMessageBatchService,
  PolymarketWebSocketCollectorService,
  MarketManagerService,
  MarketPriceChangeBatchService,
  BtcChainlinkPriceBatchService,
  PolymarketPriceWebSocketService,
} from './services';
import { PolymarketCryptoPriceService } from './services/polymarket-crypto-price.service';
import { MarketTradeBatchService } from './services/market-trade-batch.service';
import { ConfigModule } from '@nestjs/config';

const services = [
  OpenAIService,
  PolymarketGammaService,
  PolymarketCryptoPriceService,
  RawMessageBatchService,
  MarketTradeBatchService,
  MarketPriceChangeBatchService,
  PolymarketWebSocketCollectorService,
  MarketManagerService,
  BtcChainlinkPriceBatchService,
  PolymarketPriceWebSocketService,
];

@Module({
  imports: [DatabaseModule, ConfigModule],
  exports: [...services],
  providers: [...services],
})
export class BusinessModule {}
