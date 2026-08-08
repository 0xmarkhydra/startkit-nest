import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const configDb = registerAs(
  'db',
  (): TypeOrmModuleOptions => {
    const databaseUrl = process.env.DATABASE_URL?.trim();
    const instanceId = process.env.INSTANCE_ID || process.env.HOSTNAME || 'local';
    const connection = databaseUrl
      ? { url: databaseUrl }
      : {
          host: process.env.DB_HOST || 'localhost',
          port: Number(process.env.DB_PORT) || 5432,
          username: process.env.DB_USERNAME || 'root',
          password: process.env.DB_PASSWORD || 'root',
          database: process.env.DB_DATABASE || 'postgres',
        };

    return {
      type: 'postgres',
      ...connection,
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
