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
    description: 'ID của model muốn sử dụng (ví dụ: LYNXAI.01)',
    example: 'LYNXAI.01'
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
