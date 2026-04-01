import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ChatCompletionRequestDto } from './dto/chat-completion.dto';
import { AxiosError } from 'axios';
import { Readable } from 'stream';

@Injectable()
export class OpenRouterService {
  private readonly openRouterApiUrl: string;
  private readonly openRouterApiKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.openRouterApiUrl =
      this.configService.get<string>('OPENROUTER_API_URL') ||
      'https://openrouter.ai/api/v1';
    this.openRouterApiKey =
      this.configService.get<string>('OPENROUTER_API_KEY');

    if (!this.openRouterApiKey) {
      console.error(
        '🔴 [OpenRouterService] [constructor] OPENROUTER_API_KEY is not configured',
      );
    }
  }

  // Danh sách các model được hỗ trợ (có thể mở rộng)
  private readonly supportedModels = [
    // Anthropic - Claude
    'anthropic/claude-haiku-4.5',
    'anthropic/claude-opus-4.6',
    'anthropic/claude-sonnet-4.5',
    'anthropic/claude-sonnet-4.6',
    // DeepSeek
    'deepseek/deepseek-r1',
    // Google - Gemini
    'google/gemini-2.5-flash-lite',
    'google/gemini-3-flash-preview',
    'google/gemini-3-pro-preview',
    'google/gemini-3.1-pro-preview',
    // Meta - Llama
    'meta-llama/llama-3.3-70b-instruct',
    // MiniMax
    'minimax/minimax-m2.5',
    // Mistral
    'mistralai/codestral-2508',
    'mistralai/mistral-7b-instruct-v0.1',
    'mistralai/mistral-large',
    'mistralai/mistral-medium-3.1',
    'mistralai/mistral-small-3.2-24b-instruct-2506',
    // MoonshotAI - Kimi
    'moonshotai/kimi-k2-thinking',
    'moonshotai/kimi-k2.5',
    // OpenAI - GPT
    'openai/gpt-5',
    'openai/gpt-5-mini',
    'openai/gpt-5-nano',
    'openai/gpt-5.1',
    'openai/gpt-5.2',
    'openai/gpt-5.2-pro',
    'openai/gpt-5.3-chat',
    'openai/gpt-oss-120b',
    // Perplexity
    'perplexity/sonar',
    // Qwen
    'qwen/qwen3-235b-a22b',
    // xAI - Grok
    'x-ai/grok-3',
    'x-ai/grok-3-mini',
    'x-ai/grok-4',
    'x-ai/grok-4.1-fast',
    // Z AI
    'z-ai/glm-5',
  ];

  // Helper mapping cho model (có thể custom alias hoặc dùng trực tiếp)
  private mapModelName(model: string): string {
    // Nếu model đã là tên chuẩn từ OpenRouter, dùng trực tiếp
    if (this.supportedModels.includes(model)) {
      console.log(
        `[✅] [OpenRouterService] [mapModelName] Using model: ${model}`,
      );
      return model;
    }

    // Nếu model truyền vào là LYNXAI.01, ta sẽ gán cho một model cố định (fallback)
    if (model === 'LYNXAI.01') {
      console.log(
        `[🔄] [OpenRouterService] [mapModelName] Mapping ${model} to moonshotai/kimi-k2.5`,
      );
      return 'moonshotai/kimi-k2.5';
    }

    // Nếu không khớp, vẫn truyền thẳng (OpenRouter sẽ xử lý hoặc trả lỗi)
    console.log(
      `[⚠️] [OpenRouterService] [mapModelName] Unknown model: ${model}, passing through`,
    );
    return model;
  }

  /**
   * Build payload chuẩn OpenAI từ request DTO.
   * Giữ nguyên tất cả fields mà client gửi lên, chỉ map model name.
   */
  private buildPayload(requestDto: ChatCompletionRequestDto): Record<string, any> {
    const targetModel = this.mapModelName(requestDto.model);

    // Spread tất cả fields từ DTO, override model đã map
    const payload: Record<string, any> = {
      ...requestDto,
      model: targetModel,
    };

    // Loại bỏ undefined fields để tránh gửi thừa
    Object.keys(payload).forEach((key) => {
      if (payload[key] === undefined) {
        delete payload[key];
      }
    });

    return payload;
  }

  /**
   * Build common headers cho request đến OpenRouter
   */
  private buildHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.openRouterApiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://lynxai.com',
      'X-Title': 'LynxAI Forwarder',
    };
  }

  /**
   * Forward chat completion (non-streaming)
   * Trả về response data đúng chuẩn OpenAI format
   */
  async forwardChatCompletion(
    requestDto: ChatCompletionRequestDto,
  ): Promise<any> {
    const payload = this.buildPayload(requestDto);

    console.log(
      `[🔄] [OpenRouterService] [forwardChatCompletion] Calling OpenRouter API - model: ${payload.model}`,
    );

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.openRouterApiUrl}/chat/completions`,
          payload,
          { headers: this.buildHeaders() },
        ),
      );

      console.log(
        `[✅] [OpenRouterService] [forwardChatCompletion] Success`,
      );
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;

      console.error(
        `[🔴] [OpenRouterService] [forwardChatCompletion] Error:`,
        axiosError.response?.data || axiosError.message,
      );

      const statusCode =
        axiosError.response?.status || HttpStatus.INTERNAL_SERVER_ERROR;
      const errorData = axiosError.response?.data || {
        error: {
          message: 'An error occurred while communicating with OpenRouter',
          type: 'api_error',
        },
      };

      throw new HttpException(errorData, statusCode);
    }
  }

  /**
   * Forward chat completion (streaming via SSE)
   * Trả về một Readable stream để controller pipe về client
   */
  async forwardChatCompletionStream(
    requestDto: ChatCompletionRequestDto,
  ): Promise<Readable> {
    const payload = this.buildPayload(requestDto);
    // Đảm bảo stream = true trong payload
    payload.stream = true;

    console.log(
      `[🔄] [OpenRouterService] [forwardChatCompletionStream] Calling OpenRouter API (stream) - model: ${payload.model}`,
    );

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.openRouterApiUrl}/chat/completions`,
          payload,
          {
            headers: this.buildHeaders(),
            responseType: 'stream',
          },
        ),
      );

      console.log(
        `[✅] [OpenRouterService] [forwardChatCompletionStream] Stream connected`,
      );
      return response.data as Readable;
    } catch (error) {
      const axiosError = error as AxiosError;

      console.error(
        `[🔴] [OpenRouterService] [forwardChatCompletionStream] Error:`,
        axiosError.response?.data || axiosError.message,
      );

      const statusCode =
        axiosError.response?.status || HttpStatus.INTERNAL_SERVER_ERROR;
      const errorMessage =
        axiosError.message ||
        'An error occurred while communicating with OpenRouter';

      throw new HttpException(
        {
          error: {
            message: `Failed to start stream: ${errorMessage}`,
            type: 'api_error',
          },
        },
        statusCode,
      );
    }
  }
}
