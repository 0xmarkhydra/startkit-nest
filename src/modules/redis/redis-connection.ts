import { ConfigService } from '@nestjs/config';
import { RedisOptions } from 'ioredis';

export type RedisConnectionDefinition =
  | { mode: 'url'; url: string }
  | { mode: 'options'; options: RedisOptions };

export const resolveRedisConnection = (
  configService: ConfigService,
): RedisConnectionDefinition => {
  const url = configService.get<string>('REDIS_URL')?.trim();
  if (url) {
    return { mode: 'url', url };
  }

  const family = configService.get<number>('REDIS_FAMILY') ?? 0;
  const username = configService.get<string>('REDIS_USERNAME')?.trim();
  const password = configService.get<string>('REDIS_PASSWORD');

  return {
    mode: 'options',
    options: {
      host: configService.getOrThrow<string>('REDIS_HOST').trim(),
      port: configService.get<number>('REDIS_PORT') ?? 6379,
      db: configService.get<number>('REDIS_DATABASE') ?? 0,
      ...(username ? { username } : {}),
      ...(password ? { password } : {}),
      ...(family === 4 || family === 6 ? { family } : {}),
    },
  };
};
