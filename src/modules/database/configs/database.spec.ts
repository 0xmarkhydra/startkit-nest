import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { configDb } from './database';

describe('configDb', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.DB_HOST;
    delete process.env.DB_PORT;
    delete process.env.DB_USERNAME;
    delete process.env.DB_PASSWORD;
    delete process.env.DB_DATABASE;
    delete process.env.DB_SYNC;
    delete process.env.DB_DEBUG;
    delete process.env.DB_POOL_MAX;
    delete process.env.DB_RETRY_ATTEMPTS;
    delete process.env.DB_RETRY_DELAY_MS;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('passes PostgreSQL connection-string options through intact', () => {
    const url =
      'postgresql://user:pass@db.example.com:5432/app?sslmode=require&connect_timeout=7';
    process.env.DATABASE_URL = url;
    process.env.APP_ENV = 'test';

    const options = configDb() as TypeOrmModuleOptions;

    expect(options).toMatchObject({
      type: 'postgres',
      url,
      synchronize: false,
      poolSize: 10,
      retryAttempts: 3,
      retryDelay: 1000,
    });
  });

  it('rejects missing database configuration when the database module loads', () => {
    delete process.env.DATABASE_URL;

    expect(() => configDb()).toThrow('Configure DATABASE_URL');
  });

  it('rejects DB_SYNC in production', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/app';
    process.env.APP_ENV = 'production';
    process.env.DB_SYNC = 'true';

    expect(() => configDb()).toThrow('DB_SYNC must be disabled in production');
  });

  it('rejects DB_SYNC in production regardless of APP_ENV casing', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/app';
    process.env.APP_ENV = ' Production ';
    process.env.DB_SYNC = '1';

    expect(() => configDb()).toThrow('DB_SYNC must be disabled in production');
  });

  it('parses explicit boolean flags, pool sizing and retry settings', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/app';
    process.env.APP_ENV = 'test';
    process.env.DB_SYNC = 'yes';
    process.env.DB_DEBUG = 'on';
    process.env.DB_POOL_MAX = '7';
    process.env.DB_RETRY_ATTEMPTS = '5';
    process.env.DB_RETRY_DELAY_MS = '250';

    expect(configDb()).toMatchObject({
      synchronize: true,
      logging: true,
      poolSize: 7,
      retryAttempts: 5,
      retryDelay: 250,
    });
  });

  it('rejects malformed database boolean flags', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/app';
    process.env.APP_ENV = 'test';
    process.env.DB_SYNC = 'sometimes';

    expect(() => configDb()).toThrow('Invalid DB_SYNC value');
  });

  it('rejects invalid database retry settings', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/app';
    process.env.APP_ENV = 'test';
    process.env.DB_RETRY_ATTEMPTS = '0';

    expect(() => configDb()).toThrow('Invalid DB_RETRY_ATTEMPTS value');
  });
});
