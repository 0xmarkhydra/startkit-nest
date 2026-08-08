import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RedisService } from '@/redis/redis.service';
import { ResponseMessage } from '@/shared/decorators/response-message.decorator';
import { SkipRateLimit } from '@/shared/decorators/skip-rate-limit.decorator';

@ApiTags('Health')
@SkipRateLimit()
@Controller('health')
export class HealthController {
  private readonly instanceId =
    process.env.INSTANCE_ID || process.env.HOSTNAME || 'local';

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
  ) {}

  @Get()
  @ResponseMessage('API is healthy')
  @ApiOperation({ summary: 'Basic liveness check' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The API process is healthy',
  })
  healthCheck() {
    return {
      status: 'ok',
      service: 'api',
      instanceId: this.instanceId,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @ResponseMessage('API dependencies are ready')
  @ApiOperation({ summary: 'Shared dependency readiness check' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'PostgreSQL and Redis are ready',
  })
  async readinessCheck() {
    await Promise.all([this.dataSource.query('SELECT 1'), this.redisService.ping()]);

    return {
      status: 'ready',
      instanceId: this.instanceId,
      database: 'connected',
      redis: 'connected',
    };
  }
}
