import { ConfigService } from '@nestjs/config';
import { Queue } from 'bull';
import { SampleJobPayload } from '@/queue/queue.service';
import { WorkerReadinessService } from './worker-readiness.service';

const createConfig = (timeoutMs: number) =>
  ({
    get: jest.fn((key: string) =>
      key === 'WORKER_STARTUP_TIMEOUT_MS' ? timeoutMs : undefined,
    ),
  }) as unknown as ConfigService;

describe('WorkerReadinessService', () => {
  it('waits for the Bull queue before worker startup completes', async () => {
    const isReady = jest.fn().mockResolvedValue({});
    const queue = { isReady } as unknown as Queue<SampleJobPayload>;
    const service = new WorkerReadinessService(queue, createConfig(100));

    await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();
    expect(isReady).toHaveBeenCalledTimes(1);
  });

  it('fails worker startup when Bull never becomes ready', async () => {
    const queue = {
      isReady: jest.fn(
        () => new Promise<Queue<SampleJobPayload>>(() => undefined),
      ),
    } as unknown as Queue<SampleJobPayload>;
    const service = new WorkerReadinessService(queue, createConfig(5));

    await expect(service.onApplicationBootstrap()).rejects.toThrow(
      'Worker queue startup timed out',
    );
  });
});
