import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { RedisService } from '@/redis/redis.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  const createController = (options?: {
    databaseError?: Error;
    redisError?: Error;
    failOpen?: boolean;
  }) => {
    const dataSource = {
      query: options?.databaseError
        ? jest.fn().mockRejectedValue(options.databaseError)
        : jest.fn().mockResolvedValue([{ ok: 1 }]),
    } as unknown as DataSource;
    const redisService = {
      ping: options?.redisError
        ? jest.fn().mockRejectedValue(options.redisError)
        : jest.fn().mockResolvedValue('PONG'),
    } as unknown as RedisService;
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'RATE_LIMIT_FAIL_OPEN') {
          return options?.failOpen ?? false;
        }
        if (key === 'DEPENDENCY_CHECK_TIMEOUT_MS') {
          return 100;
        }
        return undefined;
      }),
    } as unknown as ConfigService;

    return new HealthController(dataSource, redisService, configService);
  };

  it('reports ready when PostgreSQL and Redis are connected', async () => {
    await expect(createController().readinessCheck()).resolves.toMatchObject({
      status: 'ready',
      database: 'connected',
      redis: 'connected',
    });
  });

  it('keeps the API ready with degraded Redis when fail-open is enabled', async () => {
    await expect(
      createController({
        redisError: new Error('Redis unavailable'),
        failOpen: true,
      }).readinessCheck(),
    ).resolves.toMatchObject({
      status: 'ready',
      database: 'connected',
      redis: 'degraded',
    });
  });

  it('fails readiness on Redis outage when fail-open is disabled', async () => {
    await expect(
      createController({
        redisError: new Error('Redis unavailable'),
        failOpen: false,
      }).readinessCheck(),
    ).rejects.toThrow('Redis unavailable');
  });

  it('always fails readiness when PostgreSQL is unavailable', async () => {
    await expect(
      createController({
        databaseError: new Error('Database unavailable'),
        failOpen: true,
      }).readinessCheck(),
    ).rejects.toThrow('Database unavailable');
  });
});
