import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { createHash } from 'crypto';
import { RedisService } from '@/redis/redis.service';
import { SKIP_RATE_LIMIT_KEY } from '@/shared/decorators/skip-rate-limit.decorator';

interface HttpRequestLike {
  ip?: string;
}

interface HttpReplyLike {
  header(name: string, value: string | number): unknown;
}

@Injectable()
export class DistributedRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(DistributedRateLimitGuard.name);
  private limiterUnavailable = false;
  private lastFailureLogAt = 0;
  private readonly failureLogIntervalMs = 30000;

  constructor(
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
    private readonly redisService: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skip) {
      return true;
    }

    const request = context.switchToHttp().getRequest<HttpRequestLike>();
    const response = context.switchToHttp().getResponse<HttpReplyLike>();
    const limit = this.configService.get<number>('RATE_LIMIT_MAX') || 60;
    const ttlSeconds =
      this.configService.get<number>('RATE_LIMIT_TTL_SECONDS') || 60;
    const tracker = request.ip || 'unknown';
    const route = `${context.getClass().name}:${context.getHandler().name}`;
    const digest = createHash('sha256')
      .update(`${route}:${tracker}`)
      .digest('hex');
    const key = `startkit:rate-limit:${digest}`;

    let record;
    try {
      record = await this.redisService.consumeSlidingWindow(
        key,
        ttlSeconds,
        limit,
      );
      this.markLimiterHealthy();
    } catch (error) {
      const failOpen =
        this.configService.get<boolean>('RATE_LIMIT_FAIL_OPEN') ?? false;
      const message = error instanceof Error ? error.message : String(error);
      this.markLimiterUnavailable(message);

      if (failOpen) {
        return true;
      }

      throw new ServiceUnavailableException('Rate limiting service unavailable');
    }

    response.header('X-RateLimit-Limit', limit);
    response.header('X-RateLimit-Remaining', Math.max(0, limit - record.totalHits));
    response.header('X-RateLimit-Reset', record.timeToExpire);

    if (!record.allowed) {
      response.header('Retry-After', record.timeToExpire);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private markLimiterUnavailable(message: string): void {
    const now = Date.now();
    if (
      !this.limiterUnavailable ||
      now - this.lastFailureLogAt >= this.failureLogIntervalMs
    ) {
      this.logger.error(`Distributed rate limiter unavailable: ${message}`);
      this.lastFailureLogAt = now;
    }
    this.limiterUnavailable = true;
  }

  private markLimiterHealthy(): void {
    if (!this.limiterUnavailable) {
      return;
    }

    this.limiterUnavailable = false;
    this.lastFailureLogAt = 0;
    this.logger.log('Distributed rate limiter recovered');
  }
}
