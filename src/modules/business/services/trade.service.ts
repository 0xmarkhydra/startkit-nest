import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Trade, TradeStatus, TradeSide } from '../../database/entities/trade.entity';
import { TelegramService } from './telegram.service';

export { Trade, TradeStatus, TradeSide } from '../../database/entities/trade.entity';

@Injectable()
export class TradeService {
  private readonly logger = new Logger(TradeService.name);

  constructor(
    @InjectRepository(Trade)
    private tradeRepository: Repository<Trade>,
    private telegramService: TelegramService,
  ) {}

  async createTrade(tradeData: Partial<Trade>): Promise<Trade> {
    const trade = this.tradeRepository.create({
      ...tradeData,
      status: TradeStatus.OPEN
    });
    
    const savedTrade = await this.tradeRepository.save(trade);
    
    // Gửi thông báo qua Telegram
    if (this.telegramService) {
      await this.telegramService.sendMessage(
        `🟢 MỞ LỆNH ${trade.side.toUpperCase()}\n` +
        `🔹 ${trade.symbol} | ${trade.quantity} ${trade.symbol.split('/')[0]}\n` +
        `💰 Giá vào: ${trade.entry_price}\n` +
        `🛑 Stop Loss: ${trade.stop_loss || 'Chưa đặt'}\n` +
        `🎯 Take Profit: ${trade.take_profit || 'Chưa đặt'}`
      );
    }

    return savedTrade;
  }

  async closeTrade(id: string, exit_price: number, reason?: string): Promise<Trade> {
    const trade = await this.tradeRepository.findOne({ where: { id } });
    if (!trade) {
      throw new Error('Không tìm thấy lệnh giao dịch');
    }

    trade.exit_price = exit_price;
    trade.status = TradeStatus.CLOSED;
    trade.reason = reason;
    trade.updated_at = new Date();

    const updatedTrade = await this.tradeRepository.save(trade);

    // Tính lãi/lỗ
    const pnl = trade.side === TradeSide.BUY 
      ? (exit_price - trade.entry_price) * trade.quantity
      : (trade.entry_price - exit_price) * trade.quantity;
    const pnlPercent = (pnl / (trade.entry_price * trade.quantity)) * 100;

    // Gửi thông báo qua Telegram
    if (this.telegramService) {
      await this.telegramService.sendMessage(
        `🔴 ĐÓNG LỆNH ${trade.side.toUpperCase()}\n` +
        `🔹 ${trade.symbol} | ${trade.quantity} ${trade.symbol.split('/')[0]}\n` +
        `💰 Giá vào: ${trade.entry_price} | Giá ra: ${exit_price}\n` +
        `📊 PnL: ${pnl.toFixed(8)} (${pnlPercent.toFixed(2)}%)\n` +
        `📝 Lý do: ${reason || 'Đóng lệnh thủ công'}`
      );
    }

    return updatedTrade;
  }

  async getOpenTrades(): Promise<Trade[]> {
    return this.tradeRepository.find({ 
      where: { status: TradeStatus.OPEN },
      order: { created_at: 'DESC' }
    });
  }

  async getTradeHistory(limit = 10): Promise<Trade[]> {
    return this.tradeRepository.find({
      order: { updated_at: 'DESC' },
      take: limit,
    });
  }

  async getTradeById(id: string): Promise<Trade> {
    const trade = await this.tradeRepository.findOne({ where: { id } });
    if (!trade) {
      throw new Error('Không tìm thấy lệnh giao dịch');
    }
    return trade;
  }
  
  async updateTrade(id: string, updateData: Partial<Trade>): Promise<Trade> {
    await this.tradeRepository.update(id, {
      ...updateData,
      updated_at: new Date()
    });
    return this.getTradeById(id);
  }
}
