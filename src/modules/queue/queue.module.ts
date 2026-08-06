import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QUEUE_NAME } from '@/shared/constants/queue';
import { QueueService } from './queue.service';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.getOrThrow<string>('queue.host'),
          port: configService.getOrThrow<number>('queue.port'),
          db: configService.get<number>('queue.database') || 0,
          username: configService.get<string>('queue.username'),
          password: configService.get<string>('queue.password'),
          family: configService.get<number>('queue.family') || 0,
          retryStrategy: (times: number) => Math.min(times * 100, 3000),
          enableOfflineQueue: true,
        },
      }),
    }),
    BullModule.registerQueue({
      name: QUEUE_NAME.SAMPLE,
    }),
  ],
  providers: [QueueService],
  exports: [QueueService, BullModule],
})
export class QueueModule {}
