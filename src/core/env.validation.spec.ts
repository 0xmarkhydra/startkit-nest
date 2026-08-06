import { validateEnvironment } from './env.validation';

describe('validateEnvironment', () => {
  const validEnvironment = {
    APP_ENV: 'test',
    PORT: '8000',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/database',
    REDIS_URL: 'redis://localhost:6379/0',
  };

  it('accepts a valid environment', () => {
    expect(validateEnvironment(validEnvironment)).toMatchObject({
      APP_ENV: 'test',
      PORT: 8000,
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
});
