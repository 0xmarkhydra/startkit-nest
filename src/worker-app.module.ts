import { Module } from '@nestjs/common';
import { CoreModule } from './core/core.module';
import { WorkerModule } from '@/worker/worker.module';

@Module({
  imports: [CoreModule, WorkerModule],
})
export class WorkerAppModule {}
