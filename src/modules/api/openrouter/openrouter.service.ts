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

  // Helper mapping cho model tên là LYNXAI.01
  private mapModelName(model: string): string {
    // Nếu model truyền vào là LYNXAI.01, ta sẽ gán cho một model cố định của OpenRouter
    if (model === 'LYNXAI.01') {
      console.log(`[🔄] [OpenRouterService] [mapModelName] Mapping ${model} to openai/gpt-3.5-turbo`);
      // TODO: Thay bằng một model mà bạn muốn dùng (ví dụ: anthropic/claude-3-haiku, google/gemini-1.5-flash, openai/gpt-3.5-turbo)
      return 'openai/gpt-3.5-turbo';
    }
    // Ngược lại, thử truyền thẳng lên OpenRouter (tùy vào cách bạn muốn thiết lập giới hạn cho khách hàng)
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
