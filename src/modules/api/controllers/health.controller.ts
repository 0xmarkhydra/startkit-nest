import {
  Controller,
  Get,
  Headers,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { assertInternalEndpointAccess } from '@/core/internal-access';
import { RedisService } from '@/redis/redis.service';
import { ResponseMessage } from '@/shared/decorators/response-message.decorator';
import { SkipRateLimit } from '@/shared/decorators/skip-rate-limit.decorator';

type DependencyStatus = 'connected' | 'disconnected';

@ApiTags('Health')
@SkipRateLimit()
@Controller('health')
export class HealthController {
  private readonly instanceId =
    process.env.INSTANCE_ID || process.env.HOSTNAME || 'local';

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  @ResponseMessage('API is healthy')
  @ApiOperation({ summary: 'Basic liveness check' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The API process is healthy',
  })
  healthCheck() {
    return this.livenessPayload();
  }

  @Get('live')
  @ResponseMessage('API is alive')
  @ApiOperation({ summary: 'Explicit liveness check' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The API process is alive',
  })
  livenessCheck() {
    return this.livenessPayload();
  }

  @Get('ready')
  @ResponseMessage('API dependencies are ready')
  @ApiOperation({ summary: 'Traffic readiness check' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Required dependencies are ready',
  })
  async readinessCheck() {
    const dependencies = await this.checkDependencies();
    const failOpen =
      this.configService.get<boolean>('RATE_LIMIT_FAIL_OPEN') ?? false;

    if (dependencies.database !== 'connected') {
      throw new ServiceUnavailableException({
        message: 'Database unavailable',
        suppressErrorLog: true,
      });
    }

    if (dependencies.redis !== 'connected' && !failOpen) {
      throw new ServiceUnavailableException({
        message: 'Redis unavailable',
        suppressErrorLog: true,
      });
    }

    return {
      status: 'ready',
      instanceId: this.instanceId,
      database: dependencies.database,
      redis:
        dependencies.redis === 'connected' ? 'connected' : ('degraded' as const),
    };
  }

  @Get('dependencies')
  @ResponseMessage('Dependency status')
  @ApiOperation({ summary: 'Protected dependency diagnostics' })
  async dependenciesCheck(@Headers('authorization') authorization?: string) {
    assertInternalEndpointAccess(
      this.configService.get<string>('APP_ENV') || 'development',
      this.configService.get<string>('INTERNAL_ENDPOINT_TOKEN'),
      authorization,
    );

    const dependencies = await this.checkDependencies();
    const healthy = Object.values(dependencies).every(
      (status) => status === 'connected',
    );

    return {
      status: healthy ? 'ok' : 'degraded',
      instanceId: this.instanceId,
      ...dependencies,
    };
  }

  private livenessPayload() {
    return {
      status: 'ok',
      service: 'api',
      instanceId: this.instanceId,
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDependencies(): Promise<{
    database: DependencyStatus;
    redis: DependencyStatus;
  }> {
    const timeoutMs =
      this.configService.get<number>('DEPENDENCY_CHECK_TIMEOUT_MS') || 2000;
    const [database, redis] = await Promise.all([
      this.check(() => this.dataSource.query('SELECT 1'), timeoutMs),
      this.check(() => this.redisService.ping(), timeoutMs),
    ]);

    return { database, redis };
  }

  private async check(
    operation: () => Promise<unknown>,
    timeoutMs: number,
  ): Promise<DependencyStatus> {
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        operation(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('Dependency check timed out')),
            timeoutMs,
          );
        }),
      ]);
      return 'connected';
    } catch {
      return 'disconnected';
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }
}
