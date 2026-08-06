import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ResponseMessage } from '@/shared/decorators/response-message.decorator';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

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
    await this.dataSource.query('SELECT 1');

    return {
      status: 'ready',
      database: 'connected',
    };
  }
}
