import { Job, Queue } from 'bull';
import { QUEUE_PROCESSOR } from '@/shared/constants/queue';
import { QueueService, SampleJobPayload } from './queue.service';

describe('QueueService', () => {
  it('adds sample jobs with bounded retry, backoff and timeout defaults', async () => {
    const add = jest.fn().mockResolvedValue({ id: 'job-1' } as Job<SampleJobPayload>);
    const queue = { add } as unknown as Queue<SampleJobPayload>;
    const service = new QueueService(queue);
    const payload: SampleJobPayload = { message: 'hello' };

    await service.addSampleJob(payload);

    expect(add).toHaveBeenCalledWith(
      QUEUE_PROCESSOR.SAMPLE.HANDLE,
      payload,
      expect.objectContaining({
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        timeout: 30000,
        removeOnComplete: 20,
        removeOnFail: 50,
      }),
    );
  });
});
