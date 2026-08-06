import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '@/database';
import { QueueModule } from '@/queue/queue.module';
import { UserConsumer } from './consumers';
import { ScheduleService } from './schedulers/schedule.service';

@Module({
  imports: [DatabaseModule, QueueModule, ScheduleModule.forRoot()],
  providers: [UserConsumer, ScheduleService],
})
export class WorkerModule {}
