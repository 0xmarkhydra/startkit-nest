import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { getQueueToken } from '@nestjs/bull';
import { Test, TestingModule } from '@nestjs/testing';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Queue } from 'bull';
import { QUEUE_NAME } from '@/shared/constants/queue';

jest.setTimeout(30000);

describe('HealthController (e2e)', () => {
  let app: NestFastifyApplication;
  let baseUrl: string;

  beforeAll(async () => {
    process.env.APP_ENV = 'test';
    process.env.RATE_LIMIT_MAX = '1000';
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ||
      'postgresql://startkit:startkit@localhost:5432/startkit';
    process.env.REDIS_URL =
      process.env.REDIS_URL || 'redis://localhost:6379/0';

    const { AppModule } = await import('../src/app.module');
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    if (!app) {
      return;
    }

    const queue = app.get<Queue>(getQueueToken(QUEUE_NAME.SAMPLE), {
      strict: false,
    });
    await queue.close().catch(() => undefined);

    const cacheManager = app.get<any>(CACHE_MANAGER, { strict: false });
    const cacheStore = cacheManager?.store;
    const cacheClient = cacheStore?.client || cacheStore?.getClient?.();

    if (typeof cacheClient?.quit === 'function') {
      await Promise.resolve(cacheClient.quit()).catch(() => undefined);
    } else if (typeof cacheClient?.disconnect === 'function') {
      cacheClient.disconnect();
    }

    await app.close();
  });

  it('GET /health returns the standardized response', async () => {
    const response = await fetch(`${baseUrl}/health`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status_code: 200,
      msg: 'API is healthy',
      data: {
        status: 'ok',
        service: 'api',
        instanceId: expect.any(String),
      },
    });
    expect(body.timestamp).toEqual(expect.any(String));
  });

  it('GET /health/ready checks PostgreSQL and Redis', async () => {
    const response = await fetch(`${baseUrl}/health/ready`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status_code: 200,
      data: {
        status: 'ready',
        database: 'connected',
        redis: 'connected',
      },
    });
  });
});
