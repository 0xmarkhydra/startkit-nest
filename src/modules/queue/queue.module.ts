import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { configQueue } from './configs';
import { QueueService } from './queue.service';
import { QUEUE_NAME } from '@/shared/constants/queue';

/**
 * Parse REDIS_URL into connection parameters
 * Format: redis://username:password@host:port/database
 */
const parseRedisUrl = (url: string) => {
  try {
    const parsedUrl = new URL(url);
    return {
      host: parsedUrl.hostname,
      port: parsedUrl.port ? Number(parsedUrl.port) : 6379,
      username: parsedUrl.username,
      password: parsedUrl.password,
      database: parsedUrl.pathname ? Number(parsedUrl.pathname.slice(1)) : 0,
    };
  } catch (error) {
    console.log(`[⚠️] [QueueModule] [parseRedisUrl] [error]:`, error);
    return null;
  }
};

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      load: [configQueue],
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory(config: ConfigService) {
        // Use REDIS_URL if available (higher priority), otherwise use config from configQueue
        const redisUrl = process.env.REDIS_URL;
        const parsedUrl = redisUrl ? parseRedisUrl(redisUrl) : null;
        
        const host = parsedUrl?.host || config.get<string>('queue.host');
        const port = parsedUrl?.port || config.get<number>('queue.port');
        const db = parsedUrl?.database || config.get<number>('queue.database');
        const password = parsedUrl?.password || config.get<string>('queue.password');
        const username = parsedUrl?.username || config.get<string>('queue.username');
        // const tls = config.get('queue.tls');
        
        console.log(`[✅] [QueueModule] [useFactory] [redisConfig]: ${redisUrl ? 'Using REDIS_URL' : 'Using individual config'}`);
        
        return {
          redis: {
            host: host,
            port: port,
            db: db,
            password: password,
            username: username,
            retryStrategy: (times: number) => {
              const delay = Math.min(times * 50, 2000);
              console.log(`[🔄] [QueueModule] [useFactory] [retryStrategy]: Retrying connection in ${delay}ms (attempt ${times})`);
              return delay;
            },
            enableOfflineQueue: true,
            reconnectOnReady: true,
          },
        };
      },
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: QUEUE_NAME.USER,
    }),
  ],
  controllers: [],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
