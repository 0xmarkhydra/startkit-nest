import { Module } from '@nestjs/common';
import { configDb } from './configs';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AdminConfigRepository,
  WsRawMessageRepository,
  MarketRegistryRepository,
  MarketTradeRepository,
  MarketPriceChangeRepository,
  BtcChainlinkPriceRepository,
  BtcBinancePriceRepository,
} from './repositories';
import {
  AdminConfigEntity,
  WsRawMessageEntity,
  MarketRegistryEntity,
  MarketTradeEntity,
  MarketPriceChangeEntity,
  BtcChainlinkPriceEntity,
  BtcBinancePriceEntity,
} from './entities';
import { SeedDatabase } from './seeders/seed.database';

const repositories = [
  AdminConfigRepository,
  WsRawMessageRepository,
  MarketRegistryRepository,
  MarketTradeRepository,
  MarketPriceChangeRepository,
  BtcChainlinkPriceRepository,
  BtcBinancePriceRepository,
];

const services = [];

const entities = [
  AdminConfigEntity,
  WsRawMessageEntity,
  MarketRegistryEntity,
  MarketTradeEntity,
  MarketPriceChangeEntity,
  BtcChainlinkPriceEntity,
  BtcBinancePriceEntity,
];

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: (config: ConfigService) => config.get('db'),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature(entities),
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      load: [configDb],
    }),
  ],
  controllers: [],
  providers: [...repositories, ...services, SeedDatabase],
  exports: [...repositories, ...services],
})
export class DatabaseModule {}
