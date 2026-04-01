import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { RequestLogService } from '../services/request-log.service';
import { StandardResponseDto } from '@/shared/dtos/standard-response.dto';
import { JwtAuthGuard } from '@/api/guards/jwt-auth.guard';
import { CurrentUser } from '@/shared/decorators/user.decorator';

@ApiTags('Logs')
@Controller({ path: 'logs', version: '1' })
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class LogController {
  constructor(private readonly requestLogService: RequestLogService) {}

  @Get()
  @ApiOperation({ summary: 'Get request logs for current user' })
  @ApiQuery({
    name: 'limit',
    description: 'Number of logs to return',
    required: false,
    type: Number,
    example: 100,
  })
  @ApiQuery({
    name: 'offset',
    description: 'Offset for pagination',
    required: false,
    type: Number,
    example: 0,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Logs retrieved successfully',
    type: () => StandardResponseDto<any[]>,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
  })
  async getLogs(
    @CurrentUser() user: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const result = await this.requestLogService.findByUserId(
      user.sub,
      parseInt(limit || '100', 10),
      parseInt(offset || '0', 10),
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'Logs retrieved successfully',
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get usage statistics for current user' })
  @ApiQuery({
    name: 'startDate',
    description: 'Start date for statistics (ISO format)',
    required: false,
    type: String,
    example: '2026-01-01T00:00:00.000Z',
  })
  @ApiQuery({
    name: 'endDate',
    description: 'End date for statistics (ISO format)',
    required: false,
    type: String,
    example: '2026-12-31T23:59:59.000Z',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Statistics retrieved successfully',
    type: () => StandardResponseDto<any>,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
  })
  async getStats(
    @CurrentUser() user: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const result = await this.requestLogService.getUserStats(
      user.sub,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'Statistics retrieved successfully',
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get detailed information about a specific log entry' })
  @ApiParam({
    name: 'id',
    description: 'Log entry ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Log retrieved successfully',
    type: () => StandardResponseDto<any>,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Log not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
  })
  async getLogById(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    const result = await this.requestLogService.findById(user.sub, id);
    return {
      statusCode: HttpStatus.OK,
      message: 'Log retrieved successfully',
      data: result,
      timestamp: new Date().toISOString(),
    };
  }
}