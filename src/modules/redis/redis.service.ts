import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';

export interface RateLimitRecord {
  allowed: boolean;
  totalHits: number;
  timeToExpire: number;
}

const SLIDING_WINDOW_SCRIPT = `
local key = KEYS[1]
local ttl = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local now = redis.call('TIME')
local nowMs = (tonumber(now[1]) * 1000) + math.floor(tonumber(now[2]) / 1000)
local cutoff = nowMs - ttl

redis.call('ZREMRANGEBYSCORE', key, '-inf', cutoff)

local count = redis.call('ZCARD', key)
local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
local oldestScore = tonumber(oldest[2]) or nowMs
local remainingMs = math.max(0, (oldestScore + ttl) - nowMs)

if count >= limit then
  return { 0, count, math.ceil(remainingMs / 1000) }
end

local sequenceKey = key .. ':sequence'
local sequence = redis.call('INCR', sequenceKey)
local member = tostring(nowMs) .. '-' .. tostring(sequence)

redis.call('ZADD', key, nowMs, member)
redis.call('PEXPIRE', key, ttl)
redis.call('PEXPIRE', sequenceKey, ttl)

count = count + 1
oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
oldestScore = tonumber(oldest[2]) or nowMs
remainingMs = math.max(0, (oldestScore + ttl) - nowMs)

return { 1, count, math.ceil(remainingMs / 1000) }
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
    const redisUrl = this.configService.get<string>('redis.url');

    if (redisUrl) {
      this.client = new Redis(redisUrl, commonOptions);
    } else {
      const family = this.configService.get<number>('redis.family');
      this.client = new Redis({
        ...commonOptions,
        host: this.configService.getOrThrow<string>('redis.host'),
        port: this.configService.getOrThrow<number>('redis.port'),
        db: this.configService.get<number>('redis.database') || 0,
        username: this.configService.get<string>('redis.username') || undefined,
        password: this.configService.get<string>('redis.password') || undefined,
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
    limit: number,
  ): Promise<RateLimitRecord> {
    const ttlMilliseconds = Math.max(1, ttlSeconds) * 1000;
    const safeLimit = Math.max(1, Math.floor(limit));
    const result = (await this.client.eval(
      SLIDING_WINDOW_SCRIPT,
      1,
      key,
      ttlMilliseconds,
      safeLimit,
    )) as [number, number, number];

    return {
      allowed: Number(result[0]) === 1,
      totalHits: Number(result[1]),
      timeToExpire: Math.max(1, Number(result[2])),
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
