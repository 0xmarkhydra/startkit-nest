import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

const hasValue = (value: string | undefined): boolean =>
  Boolean(value && value.trim().length > 0);

const parseBoolean = (
  value: string | undefined,
  name: string,
  fallback = false,
): boolean => {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  throw new Error(`Invalid ${name} value: ${value}`);
};

const parsePositiveInteger = (
  value: string | undefined,
  fallback: number,
  name: string,
): number => {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${name} value: ${String(value)}`);
  }
  return parsed;
};

const parsePort = (value: string | undefined, fallback: number): number => {
  const port = parsePositiveInteger(value, fallback, 'DB_PORT');
  if (port > 65535) {
    throw new Error(`Invalid DB_PORT value: ${String(value)}`);
  }
  return port;
};

export const configDb = registerAs(
  'db',
  (): TypeOrmModuleOptions => {
    const databaseUrl = process.env.DATABASE_URL?.trim();
    const hasDatabaseFields =
      hasValue(process.env.DB_HOST) &&
      hasValue(process.env.DB_USERNAME) &&
      hasValue(process.env.DB_PASSWORD) &&
      hasValue(process.env.DB_DATABASE);

    if (!databaseUrl && !hasDatabaseFields) {
      throw new Error(
        'Configure DATABASE_URL or DB_HOST, DB_USERNAME, DB_PASSWORD and DB_DATABASE',
      );
    }

    const synchronize = parseBoolean(process.env.DB_SYNC, 'DB_SYNC');
    const logging = parseBoolean(process.env.DB_DEBUG, 'DB_DEBUG');
    if (process.env.APP_ENV === 'production' && synchronize) {
      throw new Error(
        'DB_SYNC must be disabled in production. Use database migrations instead',
      );
    }

    const instanceId = process.env.INSTANCE_ID || process.env.HOSTNAME || 'local';
    const connection = databaseUrl
      ? { url: databaseUrl }
      : {
          host: process.env.DB_HOST!.trim(),
          port: parsePort(process.env.DB_PORT, 5432),
          username: process.env.DB_USERNAME!.trim(),
          password: process.env.DB_PASSWORD!,
          database: process.env.DB_DATABASE!.trim(),
        };
    const poolSize = parsePositiveInteger(
      process.env.DB_POOL_MAX,
      10,
      'DB_POOL_MAX',
    );

    return {
      type: 'postgres',
      ...connection,
      synchronize,
      autoLoadEntities: true,
      logging,
      poolSize,
      extra: {
        max: poolSize,
        connectionTimeoutMillis: parsePositiveInteger(
          process.env.DB_CONNECTION_TIMEOUT_MS,
          5000,
          'DB_CONNECTION_TIMEOUT_MS',
        ),
        idleTimeoutMillis: parsePositiveInteger(
          process.env.DB_IDLE_TIMEOUT_MS,
          30000,
          'DB_IDLE_TIMEOUT_MS',
        ),
        statement_timeout: parsePositiveInteger(
          process.env.DB_STATEMENT_TIMEOUT_MS,
          30000,
          'DB_STATEMENT_TIMEOUT_MS',
        ),
        application_name: `startkit:${instanceId}`,
      },
    };
  },
);
