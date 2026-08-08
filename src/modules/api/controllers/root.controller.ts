import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ResponseMessage } from '@/shared/decorators/response-message.decorator';

@ApiTags('Root')
@Controller()
export class RootController {
  private readonly instanceId =
    process.env.INSTANCE_ID || process.env.HOSTNAME || 'local';

  @Get()
  @ResponseMessage('API is running')
  @ApiOperation({ summary: 'API service information' })
  @ApiResponse({ status: HttpStatus.OK, description: 'The API is running' })
  serviceInfo() {
    return {
      status: 'ok',
      service: 'api',
      instanceId: this.instanceId,
    };
  }
}
