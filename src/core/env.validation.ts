type Environment = Record<string, unknown>;

const hasValue = (value: unknown): boolean =>
  typeof value === 'string' && value.trim().length > 0;

const parseInteger = (
  value: unknown,
  fallback: number,
  name: string,
  minimum = 1,
): number => {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw new Error(`Invalid ${name} value: ${String(value)}`);
  }
  return parsed;
};

const parsePort = (value: unknown, fallback: number): number => {
  const port = parseInteger(value, fallback, 'port');
  if (port > 65535) {
    throw new Error(`Invalid port value: ${String(value)}`);
  }
  return port;
};

const parseBooleanFlag = (value: unknown, fallback = false): boolean => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  throw new Error(`Invalid boolean value: ${String(value)}`);
};

export function validateEnvironment(config: Environment): Environment {
  const appEnv = String(config.APP_ENV || 'development');
  const errors: string[] = [];

  const hasDatabaseUrl = hasValue(config.DATABASE_URL);
  const hasDatabaseFields =
    hasValue(config.DB_HOST) &&
    hasValue(config.DB_USERNAME) &&
    hasValue(config.DB_PASSWORD) &&
    hasValue(config.DB_DATABASE);

  if (!hasDatabaseUrl && !hasDatabaseFields) {
    errors.push(
      'Configure DATABASE_URL or DB_HOST, DB_USERNAME, DB_PASSWORD and DB_DATABASE',
    );
  }

  const hasRedisUrl = hasValue(config.REDIS_URL);
  const hasRedisHost = hasValue(config.REDIS_HOST);
  if (!hasRedisUrl && !hasRedisHost) {
    errors.push('Configure REDIS_URL or REDIS_HOST');
  }

  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration:\n- ${errors.join('\n- ')}`);
  }

  return {
    ...config,
    APP_ENV: appEnv,
    PORT: parsePort(config.PORT, 8000),
    DB_PORT: parsePort(config.DB_PORT, 5432),
    REDIS_PORT: parsePort(config.REDIS_PORT, 6379),
    DB_POOL_MAX: parseInteger(config.DB_POOL_MAX, 10, 'DB_POOL_MAX'),
    DB_CONNECTION_TIMEOUT_MS: parseInteger(
      config.DB_CONNECTION_TIMEOUT_MS,
      5000,
      'DB_CONNECTION_TIMEOUT_MS',
    ),
    DB_IDLE_TIMEOUT_MS: parseInteger(
      config.DB_IDLE_TIMEOUT_MS,
      30000,
      'DB_IDLE_TIMEOUT_MS',
    ),
    DB_STATEMENT_TIMEOUT_MS: parseInteger(
      config.DB_STATEMENT_TIMEOUT_MS,
      30000,
      'DB_STATEMENT_TIMEOUT_MS',
    ),
    RATE_LIMIT_MAX: parseInteger(
      config.RATE_LIMIT_MAX,
      appEnv === 'production' ? 60 : 600,
      'RATE_LIMIT_MAX',
    ),
    RATE_LIMIT_TTL_SECONDS: parseInteger(
      config.RATE_LIMIT_TTL_SECONDS,
      60,
      'RATE_LIMIT_TTL_SECONDS',
    ),
    RATE_LIMIT_FAIL_OPEN: parseBooleanFlag(config.RATE_LIMIT_FAIL_OPEN, false),
    HTTP_BODY_LIMIT_BYTES: parseInteger(
      config.HTTP_BODY_LIMIT_BYTES,
      1048576,
      'HTTP_BODY_LIMIT_BYTES',
    ),
    HTTP_REQUEST_TIMEOUT_MS: parseInteger(
      config.HTTP_REQUEST_TIMEOUT_MS,
      30000,
      'HTTP_REQUEST_TIMEOUT_MS',
    ),
    HTTP_CONNECTION_TIMEOUT_MS: parseInteger(
      config.HTTP_CONNECTION_TIMEOUT_MS,
      10000,
      'HTTP_CONNECTION_TIMEOUT_MS',
    ),
    HTTP_KEEP_ALIVE_TIMEOUT_MS: parseInteger(
      config.HTTP_KEEP_ALIVE_TIMEOUT_MS,
      65000,
      'HTTP_KEEP_ALIVE_TIMEOUT_MS',
    ),
  };
}
