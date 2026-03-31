import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { OpenRouterService } from './openrouter.service';
import { OpenRouterController } from './openrouter.controller';

@Module({
  imports: [
    ConfigModule,
    HttpModule,
  ],
  providers: [OpenRouterService],
  controllers: [OpenRouterController],
  exports: [OpenRouterService], // Expose nếu cần sử dụng ở module khác
})
export class OpenRouterModule {}
