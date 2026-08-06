import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminConfigRepository } from '@/database/repositories';
import { ResponseMessage } from '@/shared/decorators/response-message.decorator';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly adminConfigRepository: AdminConfigRepository,
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
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @ResponseMessage('API dependencies are ready')
  @ApiOperation({ summary: 'Database readiness check' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The database connection is ready',
  })
  async readinessCheck() {
    await this.adminConfigRepository.findOne({ where: {} });
    return {
      status: 'ready',
      database: 'connected',
    };
  }
}
