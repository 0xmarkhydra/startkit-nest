import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { OpenAIService, EncryptionService, AuditLogService, WalletService } from './services';
import { ConfigModule } from '@nestjs/config';

const services = [OpenAIService, EncryptionService, AuditLogService, WalletService];

@Module({
  imports: [DatabaseModule, ConfigModule],
  exports: [...services],
  providers: [...services],
})
export class BusinessModule {}
