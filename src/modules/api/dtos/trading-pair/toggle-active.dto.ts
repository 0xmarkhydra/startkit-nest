import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ToggleActiveDto {
  @ApiProperty({
    description: 'Trạng thái kích hoạt mới',
    example: true,
    required: true
  })
  @IsBoolean()
  is_active: boolean;
}
