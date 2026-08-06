import { QUEUE_NAME, QUEUE_PROCESSOR } from '@/shared/constants/queue';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { SampleJobPayload } from '@/queue/queue.service';

@Processor(QUEUE_NAME.SAMPLE)
export class SampleConsumer {
  constructor(
    @InjectPinoLogger(SampleConsumer.name)
    private readonly logger: PinoLogger,
  ) {}

  @Process(QUEUE_PROCESSOR.SAMPLE.HANDLE)
  async handle(job: Job<SampleJobPayload>) {
    this.logger.info(
      { jobId: job.id, message: job.data.message },
      'Processed sample queue job',
    );

    return {
      processedAt: new Date().toISOString(),
    };
  }
}
