import { registerAs } from '@nestjs/config';

export const configRedis = registerAs('redis', () => {
  const url = process.env.REDIS_URL?.trim();
  const family = Number(process.env.REDIS_FAMILY) || 0;

  return {
    url: url || undefined,
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    database: Number(process.env.REDIS_DATABASE) || 0,
    username: process.env.REDIS_USERNAME || undefined,
    password: process.env.REDIS_PASSWORD || undefined,
    family: family === 4 || family === 6 ? family : undefined,
  };
});
