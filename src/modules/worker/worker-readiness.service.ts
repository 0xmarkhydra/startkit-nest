import { InjectQueue } from '@nestjs/bull';
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bull';
import { SampleJobPayload } from '@/queue/queue.service';
import { QUEUE_NAME } from '@/shared/constants/queue';

@Injectable()
export class WorkerReadinessService implements OnApplicationBootstrap {
  constructor(
    @InjectQueue(QUEUE_NAME.SAMPLE)
    private readonly sampleQueue: Queue<SampleJobPayload>,
    private readonly configService: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const timeoutMs =
      this.configService.get<number>('WORKER_STARTUP_TIMEOUT_MS') ?? 10000;
    let timer: NodeJS.Timeout | undefined;

    try {
      await Promise.race([
        this.sampleQueue.isReady(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('Worker queue startup timed out')),
            timeoutMs,
          );
        }),
      ]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }
}
