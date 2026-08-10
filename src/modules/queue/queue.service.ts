import { QUEUE_NAME, QUEUE_PROCESSOR } from '@/shared/constants/queue';
import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bull';

export type SampleJobPayload = {
  message: string;
};

@Injectable()
export class QueueService {
  constructor(
    @InjectQueue(QUEUE_NAME.SAMPLE)
    private readonly sampleQueue: Queue<SampleJobPayload>,
  ) {}

  async addSampleJob(payload: SampleJobPayload) {
    return this.sampleQueue.add(QUEUE_PROCESSOR.SAMPLE.HANDLE, payload, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      timeout: 30000,
      removeOnComplete: 20,
      removeOnFail: 50,
    });
  }
}
