import { validateEnvironment } from './env.validation';

describe('validateEnvironment', () => {
  const validEnvironment = {
    APP_ENV: 'test',
    PORT: '8000',
    JWT_SECRET_KEY: 'test-secret',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/database',
    REDIS_URL: 'redis://localhost:6379/0',
  };

  it('accepts a valid environment', () => {
    expect(validateEnvironment(validEnvironment)).toMatchObject({
      APP_ENV: 'test',
      PORT: 8000,
    });
  });

  it('rejects a missing JWT secret', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        JWT_SECRET_KEY: '',
      }),
    ).toThrow('JWT_SECRET_KEY is required');
  });

  it('rejects placeholder secrets in production', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        APP_ENV: 'production',
        JWT_SECRET_KEY: 'change-me-in-production',
      }),
    ).toThrow('JWT_SECRET_KEY must be changed in production');
  });
});
