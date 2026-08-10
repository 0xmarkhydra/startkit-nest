import { validateEnvironment } from './env.validation';

describe('validateEnvironment', () => {
  const validEnvironment = {
    APP_ENV: 'test',
    PORT: '8000',
    REDIS_URL: 'redis://localhost:6379/0',
  };

  it('accepts a valid environment and applies scaling defaults', () => {
    expect(validateEnvironment(validEnvironment)).toMatchObject({
      APP_ENV: 'test',
      PORT: 8000,
      RATE_LIMIT_MAX: 600,
      RATE_LIMIT_TTL_SECONDS: 60,
      RATE_LIMIT_FAIL_OPEN: false,
      HTTP_BODY_LIMIT_BYTES: 1048576,
      DEPENDENCY_CHECK_TIMEOUT_MS: 2000,
    });
  });

  it('does not require database configuration from shared core validation', () => {
    expect(() => validateEnvironment(validEnvironment)).not.toThrow();
  });

  it('rejects an unknown application environment', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        APP_ENV: 'prodution',
      }),
    ).toThrow('Invalid APP_ENV value');
  });

  it('rejects credentialed wildcard CORS in production', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        APP_ENV: 'production',
        CORS_ORIGIN: 'https://app.example.com,*',
      }),
    ).toThrow('CORS_ORIGIN cannot contain * in production');
  });

  it('allows wildcard CORS outside production', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        CORS_ORIGIN: '*',
      }),
    ).not.toThrow();
  });

  it('rejects a missing Redis configuration', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        REDIS_URL: '',
      }),
    ).toThrow('Configure REDIS_URL');
  });

  it('rejects an invalid port', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        PORT: '70000',
      }),
    ).toThrow('Invalid port value');
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
