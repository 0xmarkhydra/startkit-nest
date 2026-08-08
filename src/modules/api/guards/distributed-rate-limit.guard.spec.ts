import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { RedisService } from '@/redis/redis.service';
import { DistributedRateLimitGuard } from './distributed-rate-limit.guard';

const createContext = () => {
  const headers: Record<string, string | number> = {};
  const response = {
    header: jest.fn((name: string, value: string | number) => {
      headers[name] = value;
    }),
  };
  const request = { ip: '203.0.113.10' };
  const context = {
    getHandler: () => function testHandler() {},
    getClass: () => class TestController {},
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;

  return { context, headers };
};

describe('DistributedRateLimitGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(false),
  } as unknown as Reflector;

  it('writes shared rate-limit headers', async () => {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'RATE_LIMIT_MAX') return 10;
        if (key === 'RATE_LIMIT_TTL_SECONDS') return 60;
        return false;
      }),
    } as unknown as ConfigService;
    const redis = {
      consumeSlidingWindow: jest.fn().mockResolvedValue({
        totalHits: 3,
        timeToExpire: 42,
      }),
    } as unknown as RedisService;
    const guard = new DistributedRateLimitGuard(config, reflector, redis);
    const { context, headers } = createContext();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(headers).toMatchObject({
      'X-RateLimit-Limit': 10,
      'X-RateLimit-Remaining': 7,
      'X-RateLimit-Reset': 42,
    });
  });

  it('returns 429 when the shared limit is exceeded', async () => {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'RATE_LIMIT_MAX') return 2;
        if (key === 'RATE_LIMIT_TTL_SECONDS') return 60;
        return false;
      }),
    } as unknown as ConfigService;
    const redis = {
      consumeSlidingWindow: jest.fn().mockResolvedValue({
        totalHits: 3,
        timeToExpire: 20,
      }),
    } as unknown as RedisService;
    const guard = new DistributedRateLimitGuard(config, reflector, redis);
    const { context } = createContext();

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 429,
    });
  });

  it('can fail open when Redis is unavailable', async () => {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'RATE_LIMIT_MAX') return 10;
        if (key === 'RATE_LIMIT_TTL_SECONDS') return 60;
        if (key === 'RATE_LIMIT_FAIL_OPEN') return true;
        return undefined;
      }),
    } as unknown as ConfigService;
    const redis = {
      consumeSlidingWindow: jest.fn().mockRejectedValue(new Error('offline')),
    } as unknown as RedisService;
    const guard = new DistributedRateLimitGuard(config, reflector, redis);
    const { context } = createContext();

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
