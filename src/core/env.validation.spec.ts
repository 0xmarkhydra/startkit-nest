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
      LOG_LEVEL: 'debug',
      PORT: 8000,
      TRUST_PROXY: '0',
      INTERNAL_ENDPOINT_TOKEN: '',
      REDIS_DATABASE: 0,
      REDIS_FAMILY: 0,
      REDIS_CONNECT_TIMEOUT_MS: 5000,
      REDIS_COMMAND_TIMEOUT_MS: 2000,
      RATE_LIMIT_MAX: 600,
      RATE_LIMIT_TTL_SECONDS: 60,
      RATE_LIMIT_FAIL_OPEN: false,
      RATE_LIMIT_RETRY_COOLDOWN_MS: 1000,
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

  it('rejects an unsupported log level', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        LOG_LEVEL: 'verbose-ish',
      }),
    ).toThrow('Invalid LOG_LEVEL value');
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

  it('rejects CORS entries that are not exact origins', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        CORS_ORIGIN: 'https://app.example.com/path',
      }),
    ).toThrow('Use an exact http(s) origin without a path');
  });

  it('rejects a weak configured production internal token', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        APP_ENV: 'production',
        INTERNAL_ENDPOINT_TOKEN: 'too-short',
      }),
    ).toThrow('INTERNAL_ENDPOINT_TOKEN must be at least 32 characters');
  });

  it('accepts an empty or strong production internal token', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        APP_ENV: 'production',
        INTERNAL_ENDPOINT_TOKEN: '',
      }),
    ).not.toThrow();
    expect(
      validateEnvironment({
        ...validEnvironment,
        APP_ENV: 'production',
        INTERNAL_ENDPOINT_TOKEN: '0123456789abcdef0123456789abcdef',
      }),
    ).toMatchObject({
      INTERNAL_ENDPOINT_TOKEN: '0123456789abcdef0123456789abcdef',
    });
  });

  it('rejects trusting every proxy in production', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        APP_ENV: 'production',
        TRUST_PROXY: 'true',
      }),
    ).toThrow('TRUST_PROXY=true is not allowed in production');
  });

  it('accepts bounded proxy hops and explicit CIDRs', () => {
    expect(
      validateEnvironment({ ...validEnvironment, TRUST_PROXY: '2' }),
    ).toMatchObject({ TRUST_PROXY: '2' });
    expect(
      validateEnvironment({
        ...validEnvironment,
        APP_ENV: 'production',
        TRUST_PROXY: '10.0.0.0/8',
      }),
    ).toMatchObject({ TRUST_PROXY: '10.0.0.0/8' });
  });

  it('rejects malformed proxy trust values', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        TRUST_PROXY: 'flase',
      }),
    ).toThrow('Invalid TRUST_PROXY value');
  });

  it('rejects a missing Redis configuration', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        REDIS_URL: '',
      }),
    ).toThrow('Configure REDIS_URL');
  });

  it('rejects an invalid Redis database index', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        REDIS_DATABASE: '-1',
      }),
    ).toThrow('Invalid REDIS_DATABASE value');
  });

  it('rejects an unsupported Redis address family', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        REDIS_FAMILY: '5',
      }),
    ).toThrow('Invalid REDIS_FAMILY value');
  });

  it('rejects non-positive Redis timeouts', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        REDIS_COMMAND_TIMEOUT_MS: '0',
      }),
    ).toThrow('Invalid REDIS_COMMAND_TIMEOUT_MS value');
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

  it('rejects a non-positive rate limiter retry cooldown', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        RATE_LIMIT_RETRY_COOLDOWN_MS: '0',
      }),
    ).toThrow('Invalid RATE_LIMIT_RETRY_COOLDOWN_MS value');
  });
});
