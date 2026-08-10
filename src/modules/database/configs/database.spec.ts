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

  it('parses explicit boolean flags and pool sizing', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/app';
    process.env.APP_ENV = 'test';
    process.env.DB_SYNC = 'yes';
    process.env.DB_DEBUG = 'on';
    process.env.DB_POOL_MAX = '7';

    expect(configDb()).toMatchObject({
      synchronize: true,
      logging: true,
      poolSize: 7,
    });
  });

  it('rejects malformed database boolean flags', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/app';
    process.env.APP_ENV = 'test';
    process.env.DB_SYNC = 'sometimes';

    expect(() => configDb()).toThrow('Invalid DB_SYNC value');
  });
});
