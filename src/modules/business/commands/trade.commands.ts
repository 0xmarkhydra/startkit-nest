import { Command, CommandRunner } from 'nest-commander';
import { BinanceTradeService } from '../services/binance-trade.service';
import { TelegramService } from '../services/telegram.service';

@Command({ 
  name: 'trade',
  description: 'Quản lý giao dịch',
  subCommands: [
    // Các lệnh con sẽ được thêm vào đây
  ]
})
export class TradeCommands extends CommandRunner {
  constructor(
    private readonly binanceTrade: BinanceTradeService,
  ) {
    super();
  }

  async run() {
    // Lệnh mặc định khi chạy 'trade'
    console.log('Vui lòng sử dụng lệnh con. Ví dụ: trade:start');
  }
}

@Command({ 
  name: 'trade:test-telegram',
  description: 'Kiểm tra kết nối Telegram'
})
export class TestTelegramCommand extends CommandRunner {
  constructor(
    private readonly telegramService: TelegramService,
  ) {
    super();
  }

  async run() {
    try {
      console.log('Đang gửi tin nhắn kiểm tra...');
      const message = '🔔 *Kiểm tra thông báo*\n' +
                     '✅ Kết nối Telegram hoạt động bình thường\n' +
                     '🕒 ' + new Date().toLocaleString();
      
      const result = await this.telegramService.sendMessage(message);
      
      if (result) {
        console.log('✅ Đã gửi tin nhắn kiểm tra thành công');
      } else {
        console.error('❌ Không thể gửi tin nhắn kiểm tra');
      }
    } catch (error) {
      console.error('❌ Lỗi khi gửi tin nhắn kiểm tra:', error.message);
    }
  }
}

@Command({ 
  name: 'trade:test-binance',
  description: 'Kiểm tra kết nối Binance'
})
export class TestBinanceCommand extends CommandRunner {
  constructor(
    private readonly binanceTrade: BinanceTradeService,
  ) {
    super();
  }

  async run() {
    try {
      console.log('Đang kiểm tra kết nối Binance...');
      const balance = await this.binanceTrade.getAvailableBalance();
      console.log('Kết nối Binance thành công!');
      console.log('Số dư khả dụng:', balance, 'USDT');
    } catch (error) {
      console.error('Lỗi kết nối Binance:', error.message);
    }
  }
}
