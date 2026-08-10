import { Test, TestingModule } from '@nestjs/testing';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { RedisService } from '@/redis/redis.service';

jest.setTimeout(30000);

describe('HealthController (e2e)', () => {
  let app: NestFastifyApplication;
  let baseUrl: string;

  beforeAll(async () => {
    process.env.STARTKIT_PROCESS_ROLE = 'api';
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
    await app?.close();
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

  it('GET /metrics returns raw Prometheus-compatible text', async () => {
    const response = await fetch(`${baseUrl}/metrics`);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/plain');
    expect(body).toContain('# TYPE startkit_process_uptime_seconds gauge');
    expect(body).toContain('startkit_process_resident_memory_bytes');
    expect(body.trim().startsWith('{')).toBe(false);
  });

  it('caps rate-limit storage at the configured limit', async () => {
    const redisService = app.get(RedisService);
    const key = `e2e:rate-limit:${Date.now()}:${Math.random()}`;

    const first = await redisService.consumeSlidingWindow(key, 1, 2);
    const second = await redisService.consumeSlidingWindow(key, 1, 2);
    const blocked = await redisService.consumeSlidingWindow(key, 1, 2);

    expect(first).toMatchObject({ allowed: true, totalHits: 1 });
    expect(second).toMatchObject({ allowed: true, totalHits: 2 });
    expect(blocked).toMatchObject({ allowed: false, totalHits: 2 });
    expect(blocked.timeToExpire).toBeGreaterThanOrEqual(1);
  });
});
