type Environment = Record<string, unknown>;

const hasValue = (value: unknown): boolean =>
  typeof value === 'string' && value.trim().length > 0;

const parsePort = (value: unknown, fallback: number): number => {
  const port = Number(value ?? fallback);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port value: ${String(value)}`);
  }
  return port;
};

export function validateEnvironment(config: Environment): Environment {
  const appEnv = String(config.APP_ENV || 'development');
  const errors: string[] = [];

  if (!hasValue(config.JWT_SECRET_KEY)) {
    errors.push('JWT_SECRET_KEY is required');
  }

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

  if (
    appEnv === 'production' &&
    String(config.JWT_SECRET_KEY).includes('change-me')
  ) {
    errors.push('JWT_SECRET_KEY must be changed in production');
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
  };
}
