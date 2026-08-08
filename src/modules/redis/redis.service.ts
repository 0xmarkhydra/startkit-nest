import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';

export interface RateLimitRecord {
  totalHits: number;
  timeToExpire: number;
}

const SLIDING_WINDOW_SCRIPT = `
local key = KEYS[1]
local ttl = tonumber(ARGV[1])
local now = redis.call('TIME')
local nowMs = (tonumber(now[1]) * 1000) + math.floor(tonumber(now[2]) / 1000)
local cutoff = nowMs - ttl

redis.call('ZREMRANGEBYSCORE', key, '-inf', cutoff)

local sequenceKey = key .. ':sequence'
local sequence = redis.call('INCR', sequenceKey)
local member = tostring(nowMs) .. '-' .. tostring(sequence)

redis.call('ZADD', key, nowMs, member)
redis.call('PEXPIRE', key, ttl)
redis.call('PEXPIRE', sequenceKey, ttl)

local count = redis.call('ZCARD', key)
local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
local oldestScore = tonumber(oldest[2]) or nowMs
local remainingMs = math.max(0, (oldestScore + ttl) - nowMs)

return { count, math.ceil(remainingMs / 1000) }
`;

@Injectable()
export class RedisService implements OnApplicationShutdown {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(private readonly configService: ConfigService) {
    const commonOptions: RedisOptions = {
      enableReadyCheck: true,
      maxRetriesPerRequest: 2,
    };
    const redisUrl = process.env.REDIS_URL;

    if (redisUrl) {
      this.client = new Redis(redisUrl, commonOptions);
    } else {
      const family = this.configService.get<number>('queue.family');
      this.client = new Redis({
        ...commonOptions,
        host: this.configService.getOrThrow<string>('queue.host'),
        port: this.configService.getOrThrow<number>('queue.port'),
        db: this.configService.get<number>('queue.database') || 0,
        username: this.configService.get<string>('queue.username') || undefined,
        password: this.configService.get<string>('queue.password') || undefined,
        ...(family === 4 || family === 6 ? { family } : {}),
      });
    }

    this.client.on('error', (error) => {
      this.logger.error(`Redis connection error: ${error.message}`);
    });
  }

  async ping(): Promise<string> {
    return this.client.ping();
  }

  async consumeSlidingWindow(
    key: string,
    ttlSeconds: number,
  ): Promise<RateLimitRecord> {
    const ttlMilliseconds = Math.max(1, ttlSeconds) * 1000;
    const result = (await this.client.eval(
      SLIDING_WINDOW_SCRIPT,
      1,
      key,
      ttlMilliseconds,
    )) as [number, number];

    return {
      totalHits: Number(result[0]),
      timeToExpire: Math.max(1, Number(result[1])),
    };
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.client.status === 'end') {
      return;
    }

    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }
}
