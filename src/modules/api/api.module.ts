import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { DatabaseModule } from '@/database';
import { RedisModule } from '@/redis/redis.module';
import { HealthController, RootController } from './controllers';
import { DistributedRateLimitGuard } from './guards/distributed-rate-limit.guard';
import { FormatResponseInterceptor } from './interceptors';

@Module({
  imports: [DatabaseModule, RedisModule],
  controllers: [RootController, HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: DistributedRateLimitGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: FormatResponseInterceptor,
    },
  ],
})
export class ApiModule {}
