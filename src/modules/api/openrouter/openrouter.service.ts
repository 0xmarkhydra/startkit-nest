import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ChatCompletionRequestDto } from './dto/chat-completion.dto';
import { AxiosError } from 'axios';

@Injectable()
export class OpenRouterService {
  private readonly openRouterApiUrl: string;
  private readonly openRouterApiKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.openRouterApiUrl = this.configService.get<string>('OPENROUTER_API_URL') || 'https://openrouter.ai/api/v1';
    this.openRouterApiKey = this.configService.get<string>('OPENROUTER_API_KEY');

    if (!this.openRouterApiKey) {
      console.error('🔴 [OpenRouterService] [constructor] OPENROUTER_API_KEY is not configured');
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
      console.log(`[✅] [OpenRouterService] [mapModelName] Using model: ${model}`);
      return model;
    }

    // Nếu model truyền vào là LYNXAI.01, ta sẽ gán cho một model cố định (fallback)
    if (model === 'LYNXAI.01') {
      console.log(`[🔄] [OpenRouterService] [mapModelName] Mapping ${model} to moonshotai/kimi-k2.5`);
      return 'moonshotai/kimi-k2.5';
    }

    // Nếu không khớp, vẫn truyền thẳng (OpenRouter sẽ xử lý hoặc trả lỗi)
    console.log(`[⚠️] [OpenRouterService] [mapModelName] Unknown model: ${model}, passing through`);
    return model;
  }

  async forwardChatCompletion(requestDto: ChatCompletionRequestDto): Promise<any> {
    const targetModel = this.mapModelName(requestDto.model);

    // Chuẩn bị payload để gọi OpenRouter
    const payload = {
      ...requestDto,
      model: targetModel, // Sử dụng model đã được map
    };

    console.log(`[🔄] [OpenRouterService] [forwardChatCompletion] Bắt đầu gọi OpenRouter API cho model: ${targetModel}`);

    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.openRouterApiUrl}/chat/completions`, payload, {
          headers: {
            'Authorization': `Bearer ${this.openRouterApiKey}`,
            'Content-Type': 'application/json',
            // HTTP-Referer và X-Title là tuỳ chọn cho OpenRouter để xếp hạng
            'HTTP-Referer': 'https://lynxai.com', 
            'X-Title': 'LynxAI Forwarder',
          },
        })
      );

      console.log(`[✅] [OpenRouterService] [forwardChatCompletion] Thành công`);
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      
      console.error(`[🔴] [OpenRouterService] [forwardChatCompletion] Lỗi khi gọi OpenRouter API:`, 
        axiosError.response?.data || axiosError.message);

      // Trả về một HttpException với thông tin lỗi phù hợp từ OpenRouter (nếu có)
      const statusCode = axiosError.response?.status || HttpStatus.INTERNAL_SERVER_ERROR;
      const errorMessage = axiosError.response?.data || 'An error occurred while communicating with OpenRouter';

      throw new HttpException(
        {
          statusCode,
          message: 'Failed to forward request to OpenRouter',
          data: errorMessage,
        },
        statusCode,
      );
    }
  }
}
