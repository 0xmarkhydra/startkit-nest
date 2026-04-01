import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { DatabaseModule } from '@/database';
import { HealthController } from '@/api/controllers';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { QueueModule } from '@/queue/queue.module';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { redisStore } from 'cache-manager-redis-store';
import { CacheModule, CacheStore } from '@nestjs/cache-manager';
import { configAuth } from './configs/auth';
import { configCache } from './configs/cache';
import { HttpCacheInterceptor } from './interceptors';
import { BusinessModule } from '@/business/business.module';
import { OpenRouterModule } from './openrouter/openrouter.module';
import { AuthController } from '@/api/controllers/auth.controller';
import { ApiKeyController } from '@/api/controllers/api-key.controller';
import { LogController } from '@/api/controllers/log.controller';
import { AuthService } from '@/api/services/auth.service';
import { ApiKeyService } from '@/api/services/api-key.service';
import { RequestLogService } from '@/api/services/request-log.service';
import { ApiKeyRepository, UserRepository, RequestLogRepository } from '@/database/repositories';
import { JwtStrategy } from '@/api/strategies/jwt.strategy';

const controllers = [HealthController, AuthController, ApiKeyController, LogController];
const services = [AuthService, ApiKeyService, RequestLogService];
const repositories = [ApiKeyRepository, UserRepository, RequestLogRepository];

@Module({
  imports: [
    ThrottlerModule.forRoot({
      ttl: 60,
      limit: process.env.APP_ENV === 'production' ? 60 : 600,
    }),
    DatabaseModule,
    QueueModule,
    BusinessModule,
    OpenRouterModule,
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        try {
          // Use REDIS_URL if available (higher priority), otherwise build URL from individual env vars
          let urlRedis: string;
          
          if (process.env.REDIS_URL) {
            // Use REDIS_URL directly, add family if needed
            urlRedis = process.env.REDIS_URL;
            const url = new URL(urlRedis);
            if (process.env.REDIS_FAMILY) {
              url.searchParams.set('family', process.env.REDIS_FAMILY);
              urlRedis = url.toString();
            }
            console.log(`[✅] [ApiModule] [useFactory] [redisUrl]: Using REDIS_URL`);
          } else {
            // Fallback: build URL from individual environment variables
            urlRedis = `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}/${process.env.REDIS_DATABASE || 0}?family=${process.env.REDIS_FAMILY || 0}`;
            if (process.env.REDIS_PASSWORD) {
              const username = process.env.REDIS_USERNAME || '';
              urlRedis = `redis://${username}:${process.env.REDIS_PASSWORD}@${process.env.REDIS_HOST}:${process.env.REDIS_PORT}/${process.env.REDIS_DATABASE || 0}?family=${process.env.REDIS_FAMILY || 0}`;
            }
            console.log(`[✅] [ApiModule] [useFactory] [redisUrl]: Using individual env variables`);
          }
          
          const store = await redisStore({
            url: urlRedis,
            ttl: Number(configService.get('cache.api.cache_ttl')) / 1000,
          });

          // Add error handler to store if it has client
          try {
            if (store && (store as any).client) {
              const client = (store as any).client;
              
              client.on('error', (err: Error) => {
                if (err.message && err.message.includes('ECONNREFUSED')) {
                  console.log(`[🔴] [ApiModule] [useFactory] [redisError]: Redis server refused the connection - ${err.message}`);
                } else if (err.message && err.message.includes('ECONNRESET')) {
                  console.log(`[🔄] [ApiModule] [useFactory] [redisError]: Redis connection was reset - ${err.message}`);
                } else {
                  console.log(`[⚠️] [ApiModule] [useFactory] [redisError]: ${err.message || 'Unknown error'}`);
                }
              });
              
              client.on('connect', () => {
                console.log(`[✅] [ApiModule] [useFactory] [redisConnect]: Redis cache connected`);
              });
              
              if (typeof client.on === 'function') {
                client.on('ready', () => {
                  console.log(`[✅] [ApiModule] [useFactory] [redisReady]: Redis cache is ready`);
                });
                
                client.on('reconnecting', () => {
                  console.log(`[🔄] [ApiModule] [useFactory] [redisReconnecting]: Redis is reconnecting...`);
                });
              }
            }
          } catch (handlerError) {
            // Ignore error handler setup errors, store will still work
            console.log(`[⚠️] [ApiModule] [useFactory] [errorHandler]: Could not setup error handlers - ${(handlerError as Error).message}`);
          }

          return {
            ttl: configService.get('cache.api.cache_ttl'),
            store: store as unknown as CacheStore,
          };
        } catch (error) {
          console.log(`[🔴] [ApiModule] [useFactory] [error]:`, error);
          // Return memory store as fallback if Redis connection fails
          return {
            ttl: configService.get('cache.api.cache_ttl'),
            store: undefined,
          };
        }
      },
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      load: [configAuth, configCache],
    }),
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('auth.jwt.jwt_secret_key'),
        global: true,
      }),
      inject: [ConfigService],
    }),
    ThrottlerModule.forRoot({
      ttl: 60,
      limit: 10000,
    }),
  ],
  controllers: [...controllers],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpCacheInterceptor,
    },
    ...services,
    ...repositories,
    JwtStrategy,
    JwtService,
  ],
  exports: [...services],
})
export class ApiModule implements OnApplicationBootstrap {
  constructor() {}

  async onApplicationBootstrap() {}
}