import { CacheModule, CacheStore } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { redisStore } from 'cache-manager-redis-store';
import { DatabaseModule } from '@/database';
import { QueueModule } from '@/queue/queue.module';
import { HealthController } from './controllers';
import { DistributedRateLimitGuard } from './guards/distributed-rate-limit.guard';
import { FormatResponseInterceptor } from './interceptors';

@Module({
  imports: [
    DatabaseModule,
    QueueModule,
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const host = configService.getOrThrow<string>('queue.host');
        const port = configService.getOrThrow<number>('queue.port');
        const database = configService.get<number>('queue.database') || 0;
        const username = configService.get<string>('queue.username') || '';
        const password = configService.get<string>('queue.password') || '';
        const credentials = password
          ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@`
          : '';
        const url =
          process.env.REDIS_URL ||
          `redis://${credentials}${host}:${port}/${database}`;
        const ttl = configService.get<number>('cache.api.cache_ttl') || 10000;
        const isProduction = configService.get('APP_ENV') === 'production';

        try {
          const store = await redisStore({
            url,
            ttl: Math.max(1, Math.floor(ttl / 1000)),
          });

          return {
            ttl,
            store: store as unknown as CacheStore,
          };
        } catch (error) {
          if (isProduction) {
            throw error;
          }

          return { ttl };
        }
      },
    }),
  ],
  controllers: [HealthController],
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
