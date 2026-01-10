import { registerAs } from '@nestjs/config';
import process from 'process';

/**
 * Parse REDIS_URL into connection parameters
 * Format: redis://username:password@host:port/database
 */
const parseRedisUrl = (url: string) => {
  try {
    const parsedUrl = new URL(url);
    return {
      host: parsedUrl.hostname,
      port: parsedUrl.port ? Number(parsedUrl.port) : 6379,
      username: parsedUrl.username,
      password: parsedUrl.password,
      database: parsedUrl.pathname ? Number(parsedUrl.pathname.slice(1)) : 0, // Remove leading '/'
    };
  } catch (error) {
    console.log(`[⚠️] [queue.config] [parseRedisUrl] [error]:`, error);
    return null;
  }
};

export const configQueue = registerAs('queue', () => {
  // Parse REDIS_URL if available (higher priority)
  const redisUrl = process.env.REDIS_URL;
  const parsedUrl = redisUrl ? parseRedisUrl(redisUrl) : null;

  return {
    host: parsedUrl?.host || process.env.REDIS_HOST,
    port: parsedUrl?.port || Number(process.env.REDIS_PORT) || 6379,
    database: parsedUrl?.database || Number(process.env.REDIS_DATABASE) || 0,
    password: parsedUrl?.password || process.env.REDIS_PASSWORD,
    username: parsedUrl?.username || process.env.REDIS_USERNAME,
    family: Number(process.env.REDIS_FAMILY) || 0,
  };
});
