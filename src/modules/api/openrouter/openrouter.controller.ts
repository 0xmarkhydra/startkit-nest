import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpStatus,
  HttpCode,
  Res,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { OpenRouterService } from './openrouter.service';
import { ChatCompletionRequestDto } from './dto/chat-completion.dto';
import { ApiKeyGuard } from '../../../shared/guards/api-key.guard';
import { Response, Request } from 'express';

@ApiTags('OpenRouter Proxy')
@Controller('openrouter')
export class OpenRouterController {
  constructor(private readonly openRouterService: OpenRouterService) {}

  @Post('chat/completions')
  @UseGuards(ApiKeyGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Chuyển tiếp yêu cầu (Chat Completions) đến OpenRouter',
    description:
      'OpenAI-compatible endpoint. Nhận request chuẩn OpenAI Chat Completions và forward đến OpenRouter. Hỗ trợ cả streaming (SSE) và non-streaming.',
  })
  @ApiBearerAuth('LynxAI-Key')
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Thành công - trả về response đúng chuẩn OpenAI format',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Không cung cấp API Key hợp lệ',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Body không đúng chuẩn',
  })
  async createChatCompletion(
    @Body() requestDto: ChatCompletionRequestDto,
    @Res() res: Response,
  ) {
    console.log(
      `[🔄] [OpenRouterController] [createChatCompletion] Nhận request - model: ${requestDto.model}, stream: ${requestDto.stream || false}, messages: ${requestDto.messages?.length || 0}`,
    );

    // === STREAMING MODE ===
    if (requestDto.stream) {
      console.log(
        `[🔄] [OpenRouterController] [createChatCompletion] Streaming mode enabled`,
      );

      // Set SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.flushHeaders();

      try {
        const stream =
          await this.openRouterService.forwardChatCompletionStream(requestDto);

        // Pipe the stream data from OpenRouter directly to the client
        stream.on('data', (chunk: Buffer) => {
          const text = chunk.toString();
          res.write(text);
        });

        stream.on('end', () => {
          console.log(
            `[✅] [OpenRouterController] [createChatCompletion] Stream ended`,
          );
          res.end();
        });

        stream.on('error', (error: Error) => {
          console.error(
            `[🔴] [OpenRouterController] [createChatCompletion] Stream error:`,
            error.message,
          );
          // Gửi error event theo SSE format
          res.write(
            `data: ${JSON.stringify({ error: { message: error.message, type: 'stream_error' } })}\n\n`,
          );
          res.write('data: [DONE]\n\n');
          res.end();
        });
      } catch (error) {
        console.error(
          `[🔴] [OpenRouterController] [createChatCompletion] Failed to start stream:`,
          error.message,
        );
        res.write(
          `data: ${JSON.stringify({ error: { message: error.message, type: 'api_error' } })}\n\n`,
        );
        res.write('data: [DONE]\n\n');
        res.end();
      }

      return; // Đã xử lý response thủ công, không return object
    }

    // === NON-STREAMING MODE ===
    try {
      const responseData =
        await this.openRouterService.forwardChatCompletion(requestDto);

      // Trả response trực tiếp đúng chuẩn OpenAI (không wrap)
      console.log(
        `[✅] [OpenRouterController] [createChatCompletion] Thành công (non-stream)`,
      );
      return res.json(responseData);
    } catch (error) {
      console.error(
        `[🔴] [OpenRouterController] [createChatCompletion] Error:`,
        error.message,
      );

      const statusCode = error.status || HttpStatus.INTERNAL_SERVER_ERROR;
      const errorResponse = error.response || {
        error: {
          message: error.message || 'Internal server error',
          type: 'api_error',
          code: null,
        },
      };

      return res.status(statusCode).json(errorResponse);
    }
  }
}
