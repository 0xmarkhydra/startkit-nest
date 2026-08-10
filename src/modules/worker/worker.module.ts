import { Module } from '@nestjs/common';
import { QueueModule } from '@/queue/queue.module';
import { SampleConsumer } from './consumers';
import { WorkerReadinessService } from './worker-readiness.service';

@Module({
  imports: [QueueModule],
  providers: [SampleConsumer, WorkerReadinessService],
})
export class WorkerModule {}
