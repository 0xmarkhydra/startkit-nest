import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QUEUE_NAME } from '@/shared/constants/queue';
import { QueueService } from './queue.service';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const url = configService.get<string>('redis.url');
        if (url) {
          return {
            redis: url,
          };
        }

        const family = configService.get<number>('redis.family');
        return {
          redis: {
            host: configService.getOrThrow<string>('redis.host'),
            port: configService.getOrThrow<number>('redis.port'),
            db: configService.get<number>('redis.database') || 0,
            username: configService.get<string>('redis.username') || undefined,
            password: configService.get<string>('redis.password') || undefined,
            ...(family === 4 || family === 6 ? { family } : {}),
            retryStrategy: (times: number) => Math.min(times * 100, 3000),
            enableOfflineQueue: true,
          },
        };
      },
    }),
    BullModule.registerQueue({
      name: QUEUE_NAME.SAMPLE,
    }),
  ],
  providers: [QueueService],
  exports: [QueueService, BullModule],
})
export class QueueModule {}
