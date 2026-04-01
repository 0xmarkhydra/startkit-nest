import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { OpenRouterService } from './openrouter.service';
import { OpenRouterController } from './openrouter.controller';
import { ApiKeyService } from '@/api/services/api-key.service';
import { ApiKeyRepository, UserRepository, RequestLogRepository } from '@/database/repositories';

@Module({
  imports: [
    ConfigModule,
    HttpModule,
  ],
  providers: [
    OpenRouterService,
    ApiKeyService,
    ApiKeyRepository,
    UserRepository,
    RequestLogRepository,
  ],
  controllers: [OpenRouterController],
  exports: [OpenRouterService],
})
export class OpenRouterModule {}