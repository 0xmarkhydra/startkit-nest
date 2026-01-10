import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { configQueue } from './configs';
import { DatabaseModule } from '@/database';
import { ScheduleService } from './schedulers/schedule.service';
import { ScheduleModule } from '@nestjs/schedule';
import { ApiModule } from '@/api';
import { BullModule } from '@nestjs/bull';
import { UserConsumer } from './consumers';

const isWorker = Boolean(Number(process.env.IS_WORKER || 0));

let consumers = [];
let schedulers = [];

if (isWorker) {
  consumers = [UserConsumer];
  schedulers = [ScheduleService];
}

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
    console.log(`[⚠️] [WorkerModule] [parseRedisUrl] [error]:`, error);
    return null;
  }
};

@Module({
  imports: [
    ApiModule,
    DatabaseModule,
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
        
        console.log(`[✅] [WorkerModule] [useFactory] [redisConfig]: ${redisUrl ? 'Using REDIS_URL' : 'Using individual config'}`);
        
        return {
          redis: {
            host: host,
            port: port,
            db: db,
            password: password,
            username: username,
            retryStrategy: (times: number) => {
              const delay = Math.min(times * 50, 2000);
              console.log(`[🔄] [WorkerModule] [useFactory] [retryStrategy]: Retrying connection in ${delay}ms (attempt ${times})`);
              return delay;
            },
            enableOfflineQueue: true,
            reconnectOnReady: true,
            // tls,
          },
        };
      },
      inject: [ConfigService],
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      load: [configQueue],
    }),
    ScheduleModule.forRoot(),
  ],
  controllers: [],
  providers: [...consumers, ...schedulers],
  exports: [],
})
export class WorkerModule {}
