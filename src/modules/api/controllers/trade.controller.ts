import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { TradeService } from '../../business/services/trade.service';
import { Trade } from '../../database/entities/trade.entity';
import { ApiTags } from '@nestjs/swagger';


@ApiTags('Trade')
@Controller('trades')
export class TradeController {
  constructor(private readonly tradeService: TradeService) {}

  @Get()
  async getTrades(@Query('limit') limit = 10): Promise<Trade[]> {
    return this.tradeService.getTradeHistory(limit);
  }

  @Get('open')
  async getOpenTrades(): Promise<Trade[]> {
    return this.tradeService.getOpenTrades();
  }

  @Post(':id/close')
  async closeTrade(
    @Param('id') id: string,
    @Body('price') price: number,
    @Body('reason') reason?: string,
  ): Promise<Trade> {
    return this.tradeService.closeTrade(id, price, reason || 'Đóng thủ công');
  }
}
