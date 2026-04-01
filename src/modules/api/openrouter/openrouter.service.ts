import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ChatCompletionRequestDto } from './dto/chat-completion.dto';
import { AxiosError } from 'axios';
import { Readable } from 'stream';

@Injectable()
export class OpenRouterService {
  private readonly activeProvider: string;
  private readonly openRouterApiUrl: string;
  private readonly openRouterApiKey: string;
  private readonly moonshotApiUrl: string;
  private readonly moonshotApiKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.activeProvider = process.env.ACTIVE_AI_PROVIDER || 'openrouter';

    // OpenRouter Configs
    this.openRouterApiUrl = process.env.OPENROUTER_API_URL || 'https://openrouter.ai/api/v1';
    this.openRouterApiKey = process.env.OPENROUTER_API_KEY || '';

    // Moonshot Configs
    this.moonshotApiUrl = process.env.MOONSHOT_API_URL || 'https://api.moonshot.ai/v1';
    this.moonshotApiKey = process.env.MOONSHOT_API_KEY || '';

    console.log(`[🤖] [OpenRouterService] Proxy Active Provider: ${this.activeProvider}`);
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

  // Helper lấy cấu hình tương ứng với provider đang kích hoạt
  private getProviderConfig() {
    if (this.activeProvider === 'moonshot') {
      return {
        apiUrl: this.moonshotApiUrl,
        apiKey: this.moonshotApiKey,
        headers: {
          Authorization: `Bearer ${this.moonshotApiKey}`,
          'Content-Type': 'application/json',
        },
        forcedModel: 'kimi-k2.5', // Đáp ứng ngay yêu cầu dùng Kimi 2.5 xịn nhất của sếp!
      };
    }

    // Default: OpenRouter
    return {
      apiUrl: this.openRouterApiUrl,
      apiKey: this.openRouterApiKey,
      headers: {
        Authorization: `Bearer ${this.openRouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://lynxai.com',
        'X-Title': 'LynxAI Forwarder',
      },
      forcedModel: 'moonshotai/kimi-k2.5',
    };
  }

  // Helper mapping cho model — ép về model của provider hiện tại
  private mapModelName(model: string, forcedModel: string): string {
    if (model !== forcedModel) {
      console.log(`[🔄] [mapModelName] ${model} → ${forcedModel} (forced by ${this.activeProvider})`);
    }
    return forcedModel;
  }

  /**
   * Build payload chuẩn OpenAI từ request DTO.
   * Giữ nguyên tất cả fields mà client gửi lên, chỉ map model name.
   */
  private buildPayload(requestDto: ChatCompletionRequestDto, maxTokensOverride?: number): Record<string, any> {
    const config = this.getProviderConfig();
    const targetModel = this.mapModelName(requestDto.model, config.forcedModel);

    // Spread tất cả fields từ DTO, override model đã map
    const payload: Record<string, any> = {
      ...requestDto,
      model: targetModel,
    };

    // Cap max_tokens để tránh lỗi 402
    const MAX_TOKENS_LIMIT = maxTokensOverride || 4096;
    const requestedTokens = payload.max_tokens ?? payload.max_completion_tokens ?? MAX_TOKENS_LIMIT;
    const cappedTokens = Math.min(requestedTokens, MAX_TOKENS_LIMIT);

    if (requestedTokens !== cappedTokens) {
      console.log(`[⚠️] [buildPayload] Capping tokens from ${requestedTokens} to ${cappedTokens}`);
    }

    // Luôn set max_tokens rõ ràng
    payload.max_tokens = cappedTokens;
    delete payload.max_completion_tokens;

    // Tiêm (Inject) System Prompt ép buộc trả lời bằng tiếng Việt
    if (Array.isArray(payload.messages)) {
      const viInstruction = "Luôn ưu tiên trả lời và giải thích bằng tiếng Việt.";
      
      const firstMsg = payload.messages[0];
      if (firstMsg && firstMsg.role === 'system') {
        // Nếu đã có cấu hình system sẵn, đính kèm thêm
        if (typeof firstMsg.content === 'string' && !firstMsg.content.includes("tiếng Việt")) {
          firstMsg.content = `${viInstruction}\n\n${firstMsg.content}`;
        }
      } else {
        // Nếu chưa có, chèn một tin nhắn system mới vào đầu mảng
        payload.messages.unshift({
          role: 'system',
          content: viInstruction,
        });
      }
    }

    // Loại bỏ undefined fields
    Object.keys(payload).forEach((key) => {
      if (payload[key] === undefined) {
        delete payload[key];
      }
    });

    return payload;
  }

  /**
   * Build common headers cho request đến Provider
   */
  private buildHeaders(): Record<string, string> {
    return this.getProviderConfig().headers;
  }

  /**
   * Parse số token affordable từ error message 402 của OpenRouter
   * Ví dụ: "but can only afford 6126" → 6126
   */
  private parseAffordableTokens(errorBody: any): number | null {
    try {
      const msg = errorBody?.error?.message || '';
      const match = msg.match(/can only afford (\d+)/);
      return match ? parseInt(match[1], 10) : null;
    } catch {
      return null;
    }
  }

  /**
   * Đọc error body từ stream response (khi responseType: 'stream')
   */
  private async readStreamError(axiosError: AxiosError): Promise<any> {
    try {
      const rawData = axiosError.response?.data as any;
      if (rawData && typeof rawData.pipe === 'function') {
        const chunks: Buffer[] = [];
        await new Promise<void>((resolve) => {
          rawData.on('data', (chunk: Buffer) => chunks.push(chunk));
          rawData.on('end', () => resolve());
          rawData.on('error', () => resolve());
        });
        return JSON.parse(Buffer.concat(chunks).toString('utf8'));
      }
      return rawData;
    } catch {
      return { message: axiosError.message };
    }
  }

  /**
   * Forward chat completion (non-streaming) với auto-retry khi 402
   */
  async forwardChatCompletion(
    requestDto: ChatCompletionRequestDto,
  ): Promise<any> {
    const originalModel = requestDto.model; // Lưu tên model gốc từ client
    const payload = this.buildPayload(requestDto);

    console.log(
      `[🔄] [forwardChatCompletion] model: ${payload.model}, max_tokens: ${payload.max_tokens}`,
    );

    const config = this.getProviderConfig();

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${config.apiUrl}/chat/completions`,
          payload,
          { headers: this.buildHeaders() },
        ),
      );
      console.log(`[✅] [forwardChatCompletion] Success`);
      // Override model name về tên gốc để Cursor không biết
      if (response.data && response.data.model) {
        response.data.model = originalModel;
      }
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      const statusCode = axiosError.response?.status || HttpStatus.INTERNAL_SERVER_ERROR;
      const errorData = (axiosError.response?.data as any) || { error: { message: axiosError.message } };

      // Auto-retry: nếu 402 thì giảm max_tokens và thử lại
      if (statusCode === 402) {
        const affordable = this.parseAffordableTokens(errorData);
        if (affordable && affordable > 500) {
          const retryTokens = Math.floor(affordable * 0.9); // Lấy 90% để an toàn
          console.log(`[🔄] [forwardChatCompletion] 402 → Auto-retry with max_tokens: ${retryTokens}`);
          const retryPayload = this.buildPayload(requestDto, retryTokens);
          try {
            const retryResponse = await firstValueFrom(
              this.httpService.post(
                `${config.apiUrl}/chat/completions`,
                retryPayload,
                { headers: this.buildHeaders() },
              ),
            );
            console.log(`[✅] [forwardChatCompletion] Retry success with ${retryTokens} tokens`);
            if (retryResponse.data && retryResponse.data.model) {
              retryResponse.data.model = originalModel;
            }
            return retryResponse.data;
          } catch (retryError) {
            console.error(`[🔴] [forwardChatCompletion] Retry also failed`);
          }
        }
      }

      console.error(`[🔴] [forwardChatCompletion] Error: status ${statusCode}`, JSON.stringify(errorData));
      throw new HttpException(errorData, statusCode);
    }
  }

  /**
   * Forward chat completion (streaming) với auto-retry khi 402
   */
  async forwardChatCompletionStream(
    requestDto: ChatCompletionRequestDto,
  ): Promise<Readable> {
    const payload = this.buildPayload(requestDto);
    payload.stream = true;

    console.log(
      `[🔄] [forwardChatCompletionStream] model: ${payload.model}, max_tokens: ${payload.max_tokens}`,
    );

    const config = this.getProviderConfig();

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${config.apiUrl}/chat/completions`,
          payload,
          {
            headers: this.buildHeaders(),
            responseType: 'stream',
          },
        ),
      );
      console.log(`[✅] [forwardChatCompletionStream] Stream connected`);
      return response.data as Readable;
    } catch (error) {
      const axiosError = error as AxiosError;
      const statusCode = axiosError.response?.status || HttpStatus.INTERNAL_SERVER_ERROR;
      const errorBody = await this.readStreamError(axiosError);

      // Auto-retry: nếu 402 thì giảm max_tokens và thử lại
      if (statusCode === 402) {
        const affordable = this.parseAffordableTokens(errorBody);
        if (affordable && affordable > 500) {
          const retryTokens = Math.floor(affordable * 0.9);
          console.log(`[🔄] [forwardChatCompletionStream] 402 → Auto-retry with max_tokens: ${retryTokens}`);
          const retryPayload = this.buildPayload(requestDto, retryTokens);
          retryPayload.stream = true;
          try {
            const retryResponse = await firstValueFrom(
              this.httpService.post(
                `${config.apiUrl}/chat/completions`,
                retryPayload,
                {
                  headers: this.buildHeaders(),
                  responseType: 'stream',
                },
              ),
            );
            console.log(`[✅] [forwardChatCompletionStream] Retry success with ${retryTokens} tokens`);
            return retryResponse.data as Readable;
          } catch (retryError) {
            console.error(`[🔴] [forwardChatCompletionStream] Retry also failed`);
          }
        }
      }

      console.error(
        `[🔴] [forwardChatCompletionStream] Error - status: ${statusCode}, model: ${payload.model}`,
        JSON.stringify(errorBody),
      );

      throw new HttpException(
        errorBody || {
          error: {
            message: `Failed to start stream: ${axiosError.message}`,
            type: 'api_error',
          },
        },
        statusCode,
      );
    }
  }
}

