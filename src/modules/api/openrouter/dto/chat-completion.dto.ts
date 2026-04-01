import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsArray,
  IsNotEmpty,
  IsOptional,
  ValidateNested,
  IsNumber,
  IsBoolean,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Content part for multi-part messages (OpenAI vision format)
 * Ví dụ: [{ type: "text", text: "Hello" }, { type: "image_url", image_url: { url: "..." } }]
 */
export class ContentPartDto {
  @ApiProperty({ description: 'Loại content part', example: 'text' })
  @IsString()
  type: string;

  @ApiPropertyOptional({ description: 'Nội dung text', example: 'Hello' })
  @IsString()
  @IsOptional()
  text?: string;

  @ApiPropertyOptional({ description: 'Image URL object' })
  @IsOptional()
  image_url?: { url: string; detail?: string };
}

/**
 * DTO cho mỗi message trong cuộc hội thoại.
 * Tương thích với OpenAI Chat Completions API format.
 *
 * `content` có thể là:
 * - string: "Hello world"
 * - array: [{ type: "text", text: "Hello" }]
 * - null: Khi role là assistant và có tool_calls
 */
export class MessageDto {
  @ApiProperty({
    description:
      'Vai trò của người gửi tin nhắn (ví dụ: system, user, assistant, tool)',
    example: 'user',
  })
  @IsString()
  @IsNotEmpty()
  role: string;

  @ApiProperty({
    description:
      'Nội dung của tin nhắn. Có thể là string, array (multi-part content), hoặc null.',
    example: 'Xin chào, bạn có thể giúp tôi viết một bài blog không?',
  })
  @IsOptional()
  content: string | ContentPartDto[] | null;

  @ApiPropertyOptional({
    description: 'Tên người gửi (optional)',
    example: 'user_1',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    description: 'Tool calls từ assistant (OpenAI function calling)',
  })
  @IsOptional()
  tool_calls?: any[];

  @ApiPropertyOptional({
    description: 'ID của tool call mà message này trả lời',
  })
  @IsString()
  @IsOptional()
  tool_call_id?: string;
}

export class ChatCompletionRequestDto {
  @ApiProperty({
    description: `ID của model muốn sử dụng. 
Các model được hỗ trợ:
- anthropic/claude-haiku-4.5, anthropic/claude-opus-4.6, anthropic/claude-sonnet-4.5, anthropic/claude-sonnet-4.6
- deepseek/deepseek-r1
- google/gemini-2.5-flash-lite, google/gemini-3-flash-preview, google/gemini-3-pro-preview, google/gemini-3.1-pro-preview
- meta-llama/llama-3.3-70b-instruct
- minimax/minimax-m2.5
- mistralai/codestral-2508, mistralai/mistral-7b-instruct-v0.1, mistralai/mistral-large, mistralai/mistral-medium-3.1, mistralai/mistral-small-3.2-24b-instruct-2506
- moonshotai/kimi-k2-thinking, moonshotai/kimi-k2.5
- openai/gpt-5, openai/gpt-5-mini, openai/gpt-5-nano, openai/gpt-5.1, openai/gpt-5.2, openai/gpt-5.2-pro, openai/gpt-5.3-chat, openai/gpt-oss-120b
- perplexity/sonar
- qwen/qwen3-235b-a22b
- x-ai/grok-3, x-ai/grok-3-mini, x-ai/grok-4, x-ai/grok-4.1-fast
- z-ai/glm-5

Hoặc dùng alias: LYNXAI.01 (mặc định: moonshotai/kimi-k2.5)`,
    example: 'moonshotai/kimi-k2.5',
  })
  @IsString()
  @IsNotEmpty()
  model: string;

  @ApiProperty({
    description: 'Lịch sử cuộc hội thoại',
    type: [MessageDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageDto)
  messages: MessageDto[];

  @ApiPropertyOptional({ description: 'Temperature (0.0 đến 2.0)', example: 0.7 })
  @IsOptional()
  temperature?: number;

  @ApiPropertyOptional({ description: 'Streaming mode', example: false })
  @IsOptional()
  stream?: boolean;

  @ApiPropertyOptional({ description: 'Max tokens cho response' })
  @IsOptional()
  max_tokens?: number;

  // Alias mới của OpenAI (thay max_tokens)
  @ApiPropertyOptional({ description: 'Max completion tokens (OpenAI v2 alias)' })
  @IsOptional()
  max_completion_tokens?: number;

  @ApiPropertyOptional({ description: 'Top-p sampling' })
  @IsOptional()
  top_p?: number;

  @ApiPropertyOptional({ description: 'Frequency penalty' })
  @IsOptional()
  frequency_penalty?: number;

  @ApiPropertyOptional({ description: 'Presence penalty' })
  @IsOptional()
  presence_penalty?: number;

  @ApiPropertyOptional({ description: 'Stop sequences' })
  @IsOptional()
  stop?: string | string[];

  @ApiPropertyOptional({ description: 'Tools (function calling)' })
  @IsOptional()
  tools?: any[];

  @ApiPropertyOptional({ description: 'Tool choice' })
  @IsOptional()
  tool_choice?: any;

  @ApiPropertyOptional({ description: 'Stream options' })
  @IsOptional()
  stream_options?: any;

  // Anthropic extended thinking
  @ApiPropertyOptional({ description: 'Anthropic thinking config' })
  @IsOptional()
  thinking?: any;

  @ApiPropertyOptional({ description: 'Budget tokens for thinking' })
  @IsOptional()
  budget_tokens?: number;

  // OpenRouter/Anthropic reasoning effort
  @ApiPropertyOptional({ description: 'Reasoning effort level' })
  @IsOptional()
  reasoning_effort?: string;

  // Cho phép bất kỳ extra field nào từ client đi qua
  [key: string]: any;
}

