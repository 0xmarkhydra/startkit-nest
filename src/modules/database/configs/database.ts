import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

const parseDatabaseUrl = (url: string) => {
  const parsedUrl = new URL(url);

  return {
    host: parsedUrl.hostname,
    port: parsedUrl.port ? Number(parsedUrl.port) : 5432,
    username: decodeURIComponent(parsedUrl.username),
    password: decodeURIComponent(parsedUrl.password),
    database: parsedUrl.pathname.slice(1),
  };
};

export const configDb = registerAs(
  'db',
  (): TypeOrmModuleOptions => {
    const databaseUrl = process.env.DATABASE_URL;
    const parsedUrl = databaseUrl ? parseDatabaseUrl(databaseUrl) : null;
    const instanceId = process.env.INSTANCE_ID || process.env.HOSTNAME || 'local';

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
      poolSize: Number(process.env.DB_POOL_MAX) || 10,
      extra: {
        connectionTimeoutMillis:
          Number(process.env.DB_CONNECTION_TIMEOUT_MS) || 5000,
        idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS) || 30000,
        statement_timeout: Number(process.env.DB_STATEMENT_TIMEOUT_MS) || 30000,
        application_name: `startkit:${instanceId}`,
      },
    };
  },
);
