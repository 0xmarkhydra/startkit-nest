import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsArray, IsNotEmpty, IsOptional, ValidateNested, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class MessageDto {
  @ApiProperty({
    description: 'Vai trò của người gửi tin nhắn (ví dụ: system, user, assistant)',
    example: 'user'
  })
  @IsString()
  @IsNotEmpty()
  role: string;

  @ApiProperty({
    description: 'Nội dung của tin nhắn',
    example: 'Xin chào, bạn có thể giúp tôi viết một bài blog không?'
  })
  @IsString()
  @IsNotEmpty()
  content: string;
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
    example: 'moonshotai/kimi-k2.5'
  })
  @IsString()
  @IsNotEmpty()
  model: string;

  @ApiProperty({
    description: 'Lịch sử cuộc hội thoại',
    type: [MessageDto]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageDto)
  messages: MessageDto[];

  @ApiPropertyOptional({
    description: 'Giá trị Temperature để điều khiển độ sáng tạo (0.0 đến 2.0)',
    example: 0.7,
    type: Number
  })
  @IsNumber()
  @IsOptional()
  temperature?: number;

  @ApiPropertyOptional({
    description: 'Nếu là true, sẽ trả về một luồng (stream) các token',
    example: false,
    type: Boolean
  })
  @IsOptional()
  stream?: boolean;
}
