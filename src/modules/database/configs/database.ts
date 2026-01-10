import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

/**
 * Parse DATABASE_URL into connection parameters
 * Format: postgresql://username:password@host:port/database
 */
const parseDatabaseUrl = (url: string) => {
  try {
    const parsedUrl = new URL(url);
    return {
      host: parsedUrl.hostname,
      port: parsedUrl.port ? Number(parsedUrl.port) : 5432,
      username: parsedUrl.username,
      password: parsedUrl.password,
      database: parsedUrl.pathname.slice(1), // Remove leading '/'
    };
  } catch (error) {
    console.log(`[⚠️] [database.config] [parseDatabaseUrl] [error]:`, error);
    return null;
  }
};

export const configDb = registerAs(
  'db',
  (): TypeOrmModuleOptions => {
    // Parse DATABASE_URL if available (higher priority)
    const databaseUrl = process.env.DATABASE_URL;
    const parsedUrl = databaseUrl ? parseDatabaseUrl(databaseUrl) : null;

    return {
      type: 'postgres',
      host: parsedUrl?.host || process.env.DB_HOST || 'localhost',
      port: parsedUrl?.port || Number(process.env.DB_PORT) || 5432,
      username: parsedUrl?.username || process.env.DB_USERNAME || 'root',
      password: parsedUrl?.password || process.env.DB_PASSWORD || 'root',
      database: parsedUrl?.database || process.env.DB_DATABASE || 'postgres',
      synchronize: Boolean(Number(process.env.DB_SYNC)) || false,
      autoLoadEntities: true,
      logging: Boolean(Number(process.env.DB_DEBUG)) || false,
    };
  },
);
