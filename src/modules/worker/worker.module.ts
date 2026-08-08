import { Module } from '@nestjs/common';
import { QueueModule } from '@/queue/queue.module';
import { SampleConsumer } from './consumers';

@Module({
  imports: [QueueModule],
  providers: [SampleConsumer],
})
export class WorkerModule {}
