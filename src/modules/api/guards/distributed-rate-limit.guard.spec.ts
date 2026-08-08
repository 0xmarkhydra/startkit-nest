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

const createConfig = (overrides: Record<string, unknown> = {}) =>
  ({
    get: jest.fn((key: string) => {
      const values: Record<string, unknown> = {
        RATE_LIMIT_MAX: 10,
        RATE_LIMIT_TTL_SECONDS: 60,
        RATE_LIMIT_FAIL_OPEN: false,
        ...overrides,
      };
      return values[key];
    }),
  }) as unknown as ConfigService;

describe('DistributedRateLimitGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(false),
  } as unknown as Reflector;

  it('writes shared rate-limit headers', async () => {
    const redis = {
      consumeSlidingWindow: jest.fn().mockResolvedValue({
        allowed: true,
        totalHits: 3,
        timeToExpire: 42,
      }),
    } as unknown as RedisService;
    const guard = new DistributedRateLimitGuard(
      createConfig(),
      reflector,
      redis,
    );
    const { context, headers } = createContext();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(headers).toMatchObject({
      'X-RateLimit-Limit': 10,
      'X-RateLimit-Remaining': 7,
      'X-RateLimit-Reset': 42,
    });
    expect(redis.consumeSlidingWindow).toHaveBeenCalledWith(
      expect.stringContaining('startkit:rate-limit:'),
      60,
      10,
    );
  });

  it('returns 429 without increasing the recorded hit count', async () => {
    const redis = {
      consumeSlidingWindow: jest.fn().mockResolvedValue({
        allowed: false,
        totalHits: 2,
        timeToExpire: 20,
      }),
    } as unknown as RedisService;
    const guard = new DistributedRateLimitGuard(
      createConfig({ RATE_LIMIT_MAX: 2 }),
      reflector,
      redis,
    );
    const { context, headers } = createContext();

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 429,
    });
    expect(headers).toMatchObject({
      'X-RateLimit-Remaining': 0,
      'Retry-After': 20,
    });
  });

  it('can fail open when Redis is unavailable', async () => {
    const redis = {
      consumeSlidingWindow: jest.fn().mockRejectedValue(new Error('offline')),
    } as unknown as RedisService;
    const guard = new DistributedRateLimitGuard(
      createConfig({ RATE_LIMIT_FAIL_OPEN: true }),
      reflector,
      redis,
    );
    const { context } = createContext();

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('throttles repeated outage logs per replica', async () => {
    const redis = {
      consumeSlidingWindow: jest.fn().mockRejectedValue(new Error('offline')),
    } as unknown as RedisService;
    const guard = new DistributedRateLimitGuard(
      createConfig({ RATE_LIMIT_FAIL_OPEN: true }),
      reflector,
      redis,
    );
    const errorSpy = jest
      .spyOn((guard as any).logger, 'error')
      .mockImplementation(() => undefined);

    await guard.canActivate(createContext().context);
    await guard.canActivate(createContext().context);

    expect(errorSpy).toHaveBeenCalledTimes(1);
  });
});
