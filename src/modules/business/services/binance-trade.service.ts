import { Injectable, OnModuleInit, Logger, Inject, forwardRef } from '@nestjs/common';
import * as ccxt from 'ccxt';
import { RSI, MACD, ATR } from 'technicalindicators';
import { TradeService } from './trade.service';
import { TelegramService } from './telegram.service';
import { Trade, TradeSide } from '../../database/entities/trade.entity';

type OrderSide = 'buy' | 'sell';
interface CandleData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

@Injectable()
export class BinanceTradeService implements OnModuleInit {
  private readonly logger = new Logger(BinanceTradeService.name);
  private exchange: ccxt.binance;
  private symbol: string = 'BTC/USDT';
  private timeframe: string = '1h';
  
  // Cài đặt RSI
  private rsiPeriod: number = 14;
  private rsiOverbought: number = 70;
  private rsiOversold: number = 30;
  
  // Cài đặt MACD
  private macdFastPeriod: number = 12;
  private macdSlowPeriod: number = 26;
  private macdSignalPeriod: number = 9;
  
  // Cài đặt ATR
  private atrPeriod: number = 14;
  
  // Quản lý rủi ro
  private positionSize: number = 0.001; // Kích thước lệnh (BTC)
  private riskPerTrade: number = 1; // % tài khoản chịu rủi ro mỗi lệnh
  private useAtrForStopLoss: boolean = true;
  private atrMultiplier: number = 2; // Hệ số nhân ATR cho stop loss
  private takeProfitRatio: number = 2; // Tỷ lệ take profit/stop loss
  
  private isRunning: boolean = false;
  private currentPosition: Trade | null = null;
  private lastCandle: any = null;

  // Phương thức kiểm tra Telegram
  async testTelegram() {
    const message = '🔔 *Kiểm tra thông báo*\n' +
                   '✅ Kết nối Telegram hoạt động bình thường\n' +
                   '🕒 ' + new Date().toLocaleString();
    
    return this.telegramService.sendMessage(message);
  }

  constructor(
    @Inject(forwardRef(() => TradeService))
    private tradeService: TradeService,
    private telegramService: TelegramService,
  ) {
    // Khởi tạo exchange với CCXT
    this.exchange = new ccxt.binance({
      apiKey: process.env.BINANCE_API_KEY || '',
      secret: process.env.BINANCE_SECRET_KEY || '',
      enableRateLimit: true,
      options: {
        defaultType: 'future', // Sử dụng futures
      },
    });
  }

  async onModuleInit() {
    // Kiểm tra kết nối
    try {
      await this.exchange.loadMarkets();
      this.logger.log('Kết nối Binance Futures thành công');
    } catch (error) {
      this.logger.error('Lỗi kết nối Binance:', error);
      throw error;
    }
  }

  async startTrading() {
    if (this.isRunning) {
      this.logger.warn('Bot đã chạy rồi!');
      return;
    }

    this.isRunning = true;
    this.logger.log(`Bắt đầu giao dịch ${this.symbol}...`);
    
    // Kiểm tra và đóng các lệnh đang mở
    await this.checkAndCloseOpenTrades();

    // Lắng nghe dữ liệu giá mới
    while (this.isRunning) {
      try {
        // Lấy dữ liệu giá lịch sử để tính RSI
        const klines = await this.exchange.fetchOHLCV(
          this.symbol,
          this.timeframe,
          undefined,
          this.rsiPeriod * 2 // Số lượng nến cần lấy
        );

        // Chuyển đổi dữ liệu
        const closes = klines.map(k => k[4]); // Giá đóng cửa nằm ở index 4
        
        // Tính RSI
        const rsiInput = {
          values: closes,
          period: this.rsiPeriod
        };
        const rsiResult = RSI.calculate(rsiInput);
        const currentRsi = rsiResult[rsiResult.length - 1];
        const currentPrice = closes[closes.length - 1];

        this.logger.log(`Giá hiện tại: ${currentPrice} | RSI: ${currentRsi?.toFixed(2)}`);

        // Kiểm tra điều kiện giao dịch
        const indicators = {
          rsi: currentRsi,
          // Thêm các chỉ báo khác nếu cần
        };
        
        if (currentRsi < this.rsiOversold) {
          await this.placeOrder('buy', currentPrice, indicators);
        } else if (currentRsi > this.rsiOverbought) {
          await this.placeOrder('sell', currentPrice, indicators);
        }

        // Chờ 1 phút trước khi kiểm tra lại
        await new Promise(resolve => setTimeout(resolve, 60000));
      } catch (error) {
        this.logger.error('Lỗi khi xử lý dữ liệu:', error);
        // Nếu có lỗi, chờ 5 giây trước khi thử lại
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  async stopTrading() {
    this.isRunning = false;
    this.logger.log('Đang dừng giao dịch...');
    
    // Đợi cho các lệnh đang xử lý hoàn thành
    await new Promise(resolve => setTimeout(resolve, 1000));
    this.logger.log('Đã dừng giao dịch');
  }

  private async placeOrder(side: OrderSide, price: number, indicators: any) {
    try {
      // Tính toán khối lượng dựa trên rủi ro
      const balance = await this.getAvailableBalance();
      const quantity = this.calculatePositionSize(price, balance);
      
      if (quantity <= 0) {
        throw new Error('Không đủ số dư để đặt lệnh');
      }

      this.logger.log(`Tạo lệnh ${side} ${quantity} ${this.symbol} với giá ~${price}`);
      
      // Đặt lệnh thị trường
      const order = await this.exchange.createOrder(
        this.symbol,
        'market',
        side,
        quantity
      );

      // Tính stop loss và take profit
      const { stopLoss, takeProfit } = this.calculateStopLossAndTakeProfit(side, price, indicators);
      
      // Lưu thông tin giao dịch vào database
      const trade = await this.tradeService.createTrade({
        symbol: this.symbol,
        side: side as any,
        entry_price: price,
        quantity,
        stop_loss: stopLoss,
        take_profit: takeProfit,
        indicators,
      });
      
      this.currentPosition = trade;
      this.logger.log(`Đã mở lệnh #${trade.id} thành công`);
      
      return { order, trade };
    } catch (error) {
      this.logger.error(`Lỗi khi đặt lệnh ${side}:`, error);
      await this.telegramService.sendMessage(`❌ Lỗi đặt lệnh ${side}: ${error.message}`);
      throw error;
    }
  }
  
  private async closePosition(price: number, reason: string) {
    if (!this.currentPosition) return;
    
    try {
      const side = this.currentPosition.side === TradeSide.BUY ? 'sell' : 'buy';
      const quantity = this.currentPosition.quantity;
      
      this.logger.log(`Đóng vị thế ${this.currentPosition.side} với giá ~${price} (${reason})`);
      
      const order = await this.exchange.createOrder(
        this.symbol,
        'market',
        side,
        quantity
      );
      
      // Cập nhật trạng thái giao dịch
      await this.tradeService.closeTrade(this.currentPosition.id, price, reason);
      
      this.currentPosition = null;
      return order;
    } catch (error) {
      this.logger.error('Lỗi khi đóng vị thế:', error);
      await this.telegramService.sendMessage(`❌ Lỗi đóng vị thế: ${error.message}`);
      throw error;
    }
  }
  
  private async checkAndCloseOpenTrades() {
    try {
      const openTrades = await this.tradeService.getOpenTrades();
      for (const trade of openTrades) {
        await this.tradeService.closeTrade(
          trade.id, 
          trade.entry_price, 
          'Tự động đóng khi khởi động lại bot'
        );
      }
    } catch (error) {
      this.logger.error('Lỗi khi kiểm tra và đóng các lệnh mở:', error);
    }
  }
  
  private calculateStopLossAndTakeProfit(side: string, price: number, indicators: any) {
    let stopLoss, takeProfit;
    
    if (this.useAtrForStopLoss && indicators.atr) {
      // Sử dụng ATR để đặt stop loss
      const atrValue = indicators.atr;
      if (side === 'buy') {
        stopLoss = price - (atrValue * this.atrMultiplier);
        takeProfit = price + (atrValue * this.atrMultiplier * this.takeProfitRatio);
      } else {
        stopLoss = price + (atrValue * this.atrMultiplier);
        takeProfit = price - (atrValue * this.atrMultiplier * this.takeProfitRatio);
      }
    } else {
      // Sử dụng tỷ lệ cố định
      const riskPercent = 0.02; // 2% risk
      if (side === 'buy') {
        stopLoss = price * (1 - riskPercent);
        takeProfit = price * (1 + (riskPercent * this.takeProfitRatio));
      } else {
        stopLoss = price * (1 + riskPercent);
        takeProfit = price * (1 - (riskPercent * this.takeProfitRatio));
      }
    }
    
    return { stopLoss, takeProfit };
  }
  
  private calculatePositionSize(price: number, balance: number): number {
    const riskAmount = balance * (this.riskPerTrade / 100);
    const positionSize = riskAmount / price;
    return parseFloat(positionSize.toFixed(8));
  }
  
  async getAvailableBalance(): Promise<number> {
    try {
      const balance = await this.exchange.fetchBalance();
      const quoteCurrency = this.symbol.split('/')[1];
      return balance[quoteCurrency]?.free || 0;
    } catch (error) {
      this.logger.error('Lỗi khi lấy số dư:', error);
      return 0;
    }
  }

  // Phương thức phân tích kỹ thuật
  private analyzeIndicators(klines: number[][]) {
    const closes = klines.map(k => k[4]);
    const highs = klines.map(k => k[2]);
    const lows = klines.map(k => k[3]);
    
    // Tính RSI
    const rsi = RSI.calculate({
      values: closes,
      period: this.rsiPeriod
    });
    
    // Tính MACD
    const macdInput = {
      values: closes,
      fastPeriod: this.macdFastPeriod,
      slowPeriod: this.macdSlowPeriod,
      signalPeriod: this.macdSignalPeriod,
      SimpleMAOscillator: false,
      SimpleMASignal: false
    };
    const macd = MACD.calculate(macdInput);
    
    // Tính ATR
    const atrInput = {
      high: highs,
      low: lows,
      close: closes,
      period: this.atrPeriod
    };
    const atr = ATR.calculate(atrInput);
    
    // Lấy giá trị mới nhất
    const currentRsi = rsi[rsi.length - 1];
    const currentMacd = macd[macd.length - 1];
    const currentAtr = atr[atr.length - 1];
    
    // Xác định tín hiệu
    const lastMacd = macd[macd.length - 2] || { histogram: 0 };
    const macdCrossUp = currentMacd.histogram > 0 && lastMacd.histogram <= 0;
    const macdCrossDown = currentMacd.histogram < 0 && lastMacd.histogram >= 0;
    
    return {
      rsi: currentRsi,
      macd: currentMacd,
      atr: currentAtr,
      macdCrossUp,
      macdCrossDown,
      isOverbought: currentRsi > this.rsiOverbought,
      isOversold: currentRsi < this.rsiOversold
    };
  }
  
  // Các phương thức cấu hình
  setSymbol(symbol: string) {
    // Đảm bảo symbol ở định dạng chuẩn (vd: BTC/USDT)
    if (symbol.includes('/')) {
      this.symbol = symbol;
    } else {
      // Chuyển đổi từ BTCUSDT sang BTC/USDT
      const base = symbol.replace(/USDT$/, '');
      this.symbol = `${base}/USDT`;
    }
    return this;
  }
  
  setRiskManagement(riskPerTrade: number, useAtrForStopLoss: boolean, atrMultiplier = 2, takeProfitRatio = 2) {
    this.riskPerTrade = riskPerTrade;
    this.useAtrForStopLoss = useAtrForStopLoss;
    this.atrMultiplier = atrMultiplier;
    this.takeProfitRatio = takeProfitRatio;
    return this;
  }
  
  setMacdSettings(fastPeriod: number, slowPeriod: number, signalPeriod: number) {
    this.macdFastPeriod = fastPeriod;
    this.macdSlowPeriod = slowPeriod;
    this.macdSignalPeriod = signalPeriod;
    return this;
  }
  
  setAtrSettings(period: number) {
    this.atrPeriod = period;
    return this;
  }

  setTimeframe(timeframe: string) {
    this.timeframe = timeframe;
    return this;
  }

  setRsiSettings(period: number, overbought: number, oversold: number) {
    this.rsiPeriod = period;
    this.rsiOverbought = overbought;
    this.rsiOversold = oversold;
    return this;
  }

  setPositionSize(size: number) {
    this.positionSize = size;
    return this;
  }
}
