import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { SampleJobPayload } from '@/queue/queue.service';
import { QUEUE_NAME, QUEUE_PROCESSOR } from '@/shared/constants/queue';

const configuredConcurrency = Number(process.env.WORKER_CONCURRENCY || 10);
const workerConcurrency =
  Number.isInteger(configuredConcurrency) && configuredConcurrency > 0
    ? configuredConcurrency
    : 10;

@Processor(QUEUE_NAME.SAMPLE)
export class SampleConsumer {
  constructor(
    @InjectPinoLogger(SampleConsumer.name)
    private readonly logger: PinoLogger,
  ) {}

  @Process({
    name: QUEUE_PROCESSOR.SAMPLE.HANDLE,
    concurrency: workerConcurrency,
  })
  async handle(job: Job<SampleJobPayload>): Promise<{ processedAt: string }> {
    this.logger.info(
      { jobId: job.id, attemptsMade: job.attemptsMade },
      'Processed sample queue job',
    );

    return {
      processedAt: new Date().toISOString(),
    };
  }
}
