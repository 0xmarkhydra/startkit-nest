import { validateEnvironment } from './env.validation';

describe('validateEnvironment', () => {
  const validEnvironment = {
    APP_ENV: 'test',
    PORT: '8000',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/database',
    REDIS_URL: 'redis://localhost:6379/0',
  };

  it('accepts a valid environment and applies scaling defaults', () => {
    expect(validateEnvironment(validEnvironment)).toMatchObject({
      APP_ENV: 'test',
      PORT: 8000,
      DB_POOL_MAX: 10,
      RATE_LIMIT_MAX: 600,
      RATE_LIMIT_TTL_SECONDS: 60,
      RATE_LIMIT_FAIL_OPEN: false,
      HTTP_BODY_LIMIT_BYTES: 1048576,
    });
  });

  it('rejects a missing database configuration', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        DATABASE_URL: '',
      }),
    ).toThrow('Configure DATABASE_URL');
  });

  it('rejects an invalid port', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        PORT: '70000',
      }),
    ).toThrow('Invalid port value');
  });

  it('rejects an invalid database pool size', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        DB_POOL_MAX: '0',
      }),
    ).toThrow('Invalid DB_POOL_MAX value');
  });

  it('parses rate limiter fail-open flags', () => {
    expect(
      validateEnvironment({
        ...validEnvironment,
        RATE_LIMIT_FAIL_OPEN: '1',
      }),
    ).toMatchObject({ RATE_LIMIT_FAIL_OPEN: true });
  });
});
