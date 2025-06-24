import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { OpenAIService, StakingService, SolanaService } from './services';
import { ConfigModule } from '@nestjs/config';

const services = [OpenAIService, StakingService, SolanaService];

@Module({
  imports: [DatabaseModule, ConfigModule],
  exports: [...services],
  providers: [...services],
})
export class BusinessModule {}
