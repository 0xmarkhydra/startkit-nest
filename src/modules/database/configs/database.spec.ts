import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { configDb } from './database';

describe('configDb', () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  afterEach(() => {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });

  it('passes PostgreSQL connection-string options through intact', () => {
    const url =
      'postgresql://user:pass@db.example.com:5432/app?sslmode=require&connect_timeout=7';
    process.env.DATABASE_URL = url;

    const options = configDb() as TypeOrmModuleOptions;

    expect(options).toMatchObject({
      type: 'postgres',
      url,
    });
  });
});
