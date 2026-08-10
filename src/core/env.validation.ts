type Environment = Record<string, unknown>;

const APP_ENVIRONMENTS = new Set(['development', 'test', 'production']);

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
  const appEnv = String(config.APP_ENV || 'development').trim().toLowerCase();
  if (!APP_ENVIRONMENTS.has(appEnv)) {
    throw new Error(
      `Invalid APP_ENV value: ${String(config.APP_ENV)}. Expected development, test or production`,
    );
  }

  const corsOrigins = String(config.CORS_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (appEnv === 'production' && corsOrigins.includes('*')) {
    throw new Error(
      'CORS_ORIGIN cannot contain * in production while credentialed CORS is enabled',
    );
  }

  const hasRedisUrl = hasValue(config.REDIS_URL);
  const hasRedisHost = hasValue(config.REDIS_HOST);
  if (!hasRedisUrl && !hasRedisHost) {
    throw new Error(
      'Invalid environment configuration:\n- Configure REDIS_URL or REDIS_HOST',
    );
  }

  return {
    ...config,
    APP_ENV: appEnv,
    PORT: parsePort(config.PORT, 8000),
    REDIS_PORT: parsePort(config.REDIS_PORT, 6379),
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
    WORKER_CONCURRENCY: parseInteger(
      config.WORKER_CONCURRENCY,
      10,
      'WORKER_CONCURRENCY',
    ),
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
    DEPENDENCY_CHECK_TIMEOUT_MS: parseInteger(
      config.DEPENDENCY_CHECK_TIMEOUT_MS,
      2000,
      'DEPENDENCY_CHECK_TIMEOUT_MS',
    ),
  };
}
