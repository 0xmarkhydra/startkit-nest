import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/database';
import { QueueModule } from '@/queue/queue.module';
import { SampleConsumer } from './consumers';

@Module({
  imports: [DatabaseModule, QueueModule],
  providers: [SampleConsumer],
})
export class WorkerModule {}
