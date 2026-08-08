import { configRedis } from './redis';

describe('configRedis', () => {
  const originalRedisUrl = process.env.REDIS_URL;

  afterEach(() => {
    if (originalRedisUrl === undefined) {
      delete process.env.REDIS_URL;
    } else {
      process.env.REDIS_URL = originalRedisUrl;
    }
  });

  it('preserves a rediss URL for all Redis consumers', () => {
    const url = 'rediss://user:pass@redis.example.com:6380/2';
    process.env.REDIS_URL = url;

    expect(configRedis()).toMatchObject({ url });
  });
});
