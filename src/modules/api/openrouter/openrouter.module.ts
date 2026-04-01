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
    HttpModule.register({
      timeout: 600_000,          // 10 phút - đủ cho LLM long response
      maxRedirects: 3,
      maxContentLength: 100 * 1024 * 1024, // 100MB
      maxBodyLength: 100 * 1024 * 1024,    // 100MB
      httpsAgent: new (require('https').Agent)({
        keepAlive: true,
        timeout: 600_000,
      }),
    }),
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