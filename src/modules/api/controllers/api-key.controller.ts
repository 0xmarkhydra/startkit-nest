import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { ApiKeyService } from '../services/api-key.service';
import { CreateApiKeyDto, ApiKeyResponseDto } from '../dtos/api-key';
import { StandardResponseDto } from '@/shared/dtos/standard-response.dto';
import { JwtAuthGuard } from '@/api/guards/jwt-auth.guard';
import { CurrentUser } from '@/shared/decorators/user.decorator';

@ApiTags('API Keys')
@Controller({ path: 'api-keys', version: '1' })
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Get()
  @ApiOperation({ summary: 'Get all API keys for current user' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'API keys retrieved successfully',
    type: () => StandardResponseDto<ApiKeyResponseDto[]>,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
  })
  async getAllApiKeys(@CurrentUser() user: any) {
    const result = await this.apiKeyService.findAllByUserId(user.sub);
    return {
      statusCode: HttpStatus.OK,
      message: 'API keys retrieved successfully',
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  @Post()
  @ApiOperation({ summary: 'Create a new API key' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'API key created successfully. The full key is only shown once.',
    type: () => StandardResponseDto<ApiKeyResponseDto>,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
  })
  async createApiKey(
    @CurrentUser() user: any,
    @Body() createApiKeyDto: CreateApiKeyDto,
  ) {
    const result = await this.apiKeyService.create(user.sub, createApiKeyDto);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'API key created successfully. Please save this key now as it will not be shown again.',
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an API key' })
  @ApiParam({
    name: 'id',
    description: 'API key ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'API key deleted successfully',
    type: () => StandardResponseDto<null>,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'API key not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
  })
  async deleteApiKey(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    await this.apiKeyService.delete(user.sub, id);
    return {
      statusCode: HttpStatus.OK,
      message: 'API key deleted successfully',
      data: null,
      timestamp: new Date().toISOString(),
    };
  }
}