import { CacheModule, CacheStore } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { redisStore } from 'cache-manager-redis-store';
import { DatabaseModule } from '@/database';
import { QueueModule } from '@/queue/queue.module';
import { HealthController } from './controllers';
import { FormatResponseInterceptor } from './interceptors';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      ttl: 60,
      limit: process.env.APP_ENV === 'production' ? 60 : 600,
    }),
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

        try {
          const store = await redisStore({
            url,
            ttl: Math.max(1, Math.floor(ttl / 1000)),
          });

          return {
            ttl,
            store: store as unknown as CacheStore,
          };
        } catch {
          return { ttl };
        }
      },
    }),
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: FormatResponseInterceptor,
    },
  ],
})
export class ApiModule {}
