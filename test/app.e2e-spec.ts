import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

describe('HealthController (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    process.env.APP_ENV = 'test';
    process.env.JWT_SECRET_KEY = 'test-secret';
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ||
      'postgresql://startkit:startkit@localhost:5432/startkit';
    process.env.REDIS_URL =
      process.env.REDIS_URL || 'redis://localhost:6379/0';

    const { AppModule } = await import('../src/app.module');
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
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
      },
    });
    expect(body.timestamp).toEqual(expect.any(String));
  });
});
