import { Controller, Post, Body, UseGuards, HttpStatus, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { OpenRouterService } from './openrouter.service';
import { ChatCompletionRequestDto } from './dto/chat-completion.dto';
import { ApiKeyGuard } from '../../../shared/guards/api-key.guard';
import { StandardResponseDto } from '../../../shared/dtos/standard-response.dto';

@ApiTags('OpenRouter Proxy')
@Controller('openrouter') // Theo chuẩn kebab-case của dự án nếu cần có thể đổi thành open-router
export class OpenRouterController {
  constructor(private readonly openRouterService: OpenRouterService) {}

  @Post('chat/completions')
  @UseGuards(ApiKeyGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Chuyển tiếp yêu cầu (Chat Completions) đến OpenRouter',
    description: 'Endpoint nhận yêu cầu tạo văn bản AI bằng khóa LynxAI (qua Bearer Token header). Server sẽ map model `LYNXAI.01` sang một model OpenRouter thực tế và gọi lên API OpenRouter.',
  })
  @ApiBearerAuth('LynxAI-Key')
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Thành công nhận kết quả từ OpenRouter',
    type: StandardResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Không cung cấp API Key hợp lệ',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Body không đúng chuẩn',
  })
  async createChatCompletion(@Body() requestDto: ChatCompletionRequestDto) {
    console.log(`[🔄] [OpenRouterController] [createChatCompletion] Nhận request chuyển tiếp`);
    
    // Gọi Service xử lý forward
    const responseData = await this.openRouterService.forwardChatCompletion(requestDto);

    return {
      statusCode: HttpStatus.OK,
      message: 'Chuyển tiếp yêu cầu tới OpenRouter thành công',
      data: responseData,
      timestamp: new Date().toISOString()
    };
  }
}
