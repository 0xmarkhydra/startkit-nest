import { ConfigService } from '@nestjs/config';
import { resolveRedisConnection } from './redis-connection';

const createConfig = (values: Record<string, unknown>) =>
  ({
    get: jest.fn((key: string) => values[key]),
    getOrThrow: jest.fn((key: string) => {
      const value = values[key];
      if (value === undefined || value === null || value === '') {
        throw new Error(`Missing ${key}`);
      }
      return value;
    }),
  }) as unknown as ConfigService;

describe('resolveRedisConnection', () => {
  it('preserves redis and rediss URLs without reparsing them', () => {
    const url = 'rediss://user:pass@redis.example.com:6380/2';

    expect(resolveRedisConnection(createConfig({ REDIS_URL: url }))).toEqual({
      mode: 'url',
      url,
    });
  });

  it('builds one host-mode option object for all Redis consumers', () => {
    const connection = resolveRedisConnection(
      createConfig({
        REDIS_HOST: 'redis.internal',
        REDIS_PORT: 6380,
        REDIS_DATABASE: 3,
        REDIS_USERNAME: 'app',
        REDIS_PASSWORD: 'secret',
        REDIS_FAMILY: 6,
      }),
    );

    expect(connection).toEqual({
      mode: 'options',
      options: {
        host: 'redis.internal',
        port: 6380,
        db: 3,
        username: 'app',
        password: 'secret',
        family: 6,
      },
    });
  });
});
