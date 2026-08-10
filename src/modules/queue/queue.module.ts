import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolveRedisConnection } from '@/redis/redis-connection';
import { QUEUE_NAME } from '@/shared/constants/queue';
import { QueueService } from './queue.service';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const connection = resolveRedisConnection(configService);
        return {
          redis:
            connection.mode === 'url' ? connection.url : connection.options,
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
