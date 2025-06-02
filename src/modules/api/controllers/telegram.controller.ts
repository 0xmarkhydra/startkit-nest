import { Controller, Get } from '@nestjs/common';
import { TelegramService } from '../../business/services/telegram.service';
import { ApiTags } from '@nestjs/swagger';
import { ResponseMessage } from '@/shared/decorators/response-message.decorator';
import { ApiBaseResponse } from '@/shared/swagger/decorator/api-response.decorator';
import { HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Telegram')
@Controller('telegram')
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  @Get('ping')
  @ResponseMessage('Kiểm tra Telegram')
  @ApiOperation({ summary: 'Kiểm tra kết nối Telegram' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Kết nối Telegram hoạt động bình thường' })
  async testTelegram() {
    const message = '🔔 *Kiểm tra thông báo*\n' +
                   '✅ Kết nối Telegram hoạt động bình thường\n' +
                   '🕒 ' + new Date().toLocaleString();
    
    const result = await this.telegramService.sendMessage(message);
    
    return {
      success: result,
      message: result ? 'Đã gửi tin nhắn kiểm tra' : 'Gửi tin nhắn thất bại'
    };
  }
}
