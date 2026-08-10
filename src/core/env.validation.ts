import { isValidProxyAddress } from './http-options';

type Environment = Record<string, unknown>;

const APP_ENVIRONMENTS = new Set(['development', 'test', 'production']);
const LOG_LEVELS = new Set([
  'trace',
  'debug',
  'info',
  'warn',
  'error',
  'fatal',
  'silent',
]);
const MIN_INTERNAL_TOKEN_LENGTH = 32;

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

const validateCorsOrigins = (value: unknown, appEnv: string): string[] => {
  const origins = String(value || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  for (const origin of origins) {
    if (origin === '*') {
      if (appEnv === 'production') {
        throw new Error(
          'CORS_ORIGIN cannot contain * in production while credentialed CORS is enabled',
        );
      }
      continue;
    }

    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(`Invalid CORS_ORIGIN value: ${origin}`);
    }

    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin) {
      throw new Error(
        `Invalid CORS_ORIGIN value: ${origin}. Use an exact http(s) origin without a path`,
      );
    }
  }

  return origins;
};

const validateTrustProxy = (value: unknown, appEnv: string): string => {
  const normalized = String(value ?? '0').trim().toLowerCase();

  if (['0', 'false'].includes(normalized)) {
    return '0';
  }
  if (normalized === 'true') {
    if (appEnv === 'production') {
      throw new Error(
        'TRUST_PROXY=true is not allowed in production. Use a bounded hop count or explicit proxy IP/CIDR',
      );
    }
    return 'true';
  }
  if (/^[1-9]\d*$/.test(normalized)) {
    return normalized;
  }
  if (isValidProxyAddress(normalized)) {
    return normalized;
  }

  throw new Error(`Invalid TRUST_PROXY value: ${String(value)}`);
};

const validateInternalEndpointToken = (
  value: unknown,
  appEnv: string,
): string => {
  const token = String(value ?? '').trim();
  if (
    appEnv === 'production' &&
    token.length > 0 &&
    token.length < MIN_INTERNAL_TOKEN_LENGTH
  ) {
    throw new Error(
      `INTERNAL_ENDPOINT_TOKEN must be at least ${MIN_INTERNAL_TOKEN_LENGTH} characters when configured in production`,
    );
  }
  return token;
};

export function validateEnvironment(config: Environment): Environment {
  const appEnv = String(config.APP_ENV || 'development').trim().toLowerCase();
  if (!APP_ENVIRONMENTS.has(appEnv)) {
    throw new Error(
      `Invalid APP_ENV value: ${String(config.APP_ENV)}. Expected development, test or production`,
    );
  }

  const logLevel = String(
    config.LOG_LEVEL || (appEnv === 'production' ? 'info' : 'debug'),
  )
    .trim()
    .toLowerCase();
  if (!LOG_LEVELS.has(logLevel)) {
    throw new Error(`Invalid LOG_LEVEL value: ${String(config.LOG_LEVEL)}`);
  }

  const corsOrigins = validateCorsOrigins(config.CORS_ORIGIN, appEnv);
  const trustProxy = validateTrustProxy(config.TRUST_PROXY, appEnv);
  const internalEndpointToken = validateInternalEndpointToken(
    config.INTERNAL_ENDPOINT_TOKEN,
    appEnv,
  );

  const hasRedisUrl = hasValue(config.REDIS_URL);
  const hasRedisHost = hasValue(config.REDIS_HOST);
  if (!hasRedisUrl && !hasRedisHost) {
    throw new Error(
      'Invalid environment configuration:\n- Configure REDIS_URL or REDIS_HOST',
    );
  }

  const redisFamily = parseInteger(config.REDIS_FAMILY, 0, 'REDIS_FAMILY', 0);
  if (![0, 4, 6].includes(redisFamily)) {
    throw new Error(`Invalid REDIS_FAMILY value: ${String(config.REDIS_FAMILY)}`);
  }

  return {
    ...config,
    APP_ENV: appEnv,
    LOG_LEVEL: logLevel,
    CORS_ORIGIN: corsOrigins.join(','),
    INTERNAL_ENDPOINT_TOKEN: internalEndpointToken,
    TRUST_PROXY: trustProxy,
    PORT: parsePort(config.PORT, 8000),
    REDIS_PORT: parsePort(config.REDIS_PORT, 6379),
    REDIS_DATABASE: parseInteger(
      config.REDIS_DATABASE,
      0,
      'REDIS_DATABASE',
      0,
    ),
    REDIS_FAMILY: redisFamily,
    REDIS_CONNECT_TIMEOUT_MS: parseInteger(
      config.REDIS_CONNECT_TIMEOUT_MS,
      5000,
      'REDIS_CONNECT_TIMEOUT_MS',
    ),
    REDIS_COMMAND_TIMEOUT_MS: parseInteger(
      config.REDIS_COMMAND_TIMEOUT_MS,
      2000,
      'REDIS_COMMAND_TIMEOUT_MS',
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
    RATE_LIMIT_RETRY_COOLDOWN_MS: parseInteger(
      config.RATE_LIMIT_RETRY_COOLDOWN_MS,
      1000,
      'RATE_LIMIT_RETRY_COOLDOWN_MS',
    ),
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
