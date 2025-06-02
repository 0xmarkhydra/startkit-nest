import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateTradingPairDto {
  @ApiProperty({
    description: 'Mã cặp tiền tệ (ví dụ: BTC/USDT)',
    example: 'BTC/USDT',
    required: true
  })
  @IsString()
  @IsNotEmpty()
  symbol: string;

  @ApiProperty({
    description: 'Kích hoạt giao dịch cho cặp này',
    example: true,
    required: false,
    default: true
  })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}

export class UpdateTradingPairDto extends PartialType(CreateTradingPairDto) {}
