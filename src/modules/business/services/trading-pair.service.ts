import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TradingPair } from '../../database/entities/trading-pair.entity';

@Injectable()
export class TradingPairService {
  private readonly logger = new Logger(TradingPairService.name);

  constructor(
    @InjectRepository(TradingPair)
    private tradingPairRepository: Repository<TradingPair>,
  ) {}

  async findAll(): Promise<TradingPair[]> {
    return this.tradingPairRepository.find();
  }

  async findActive(): Promise<TradingPair[]> {
    return this.tradingPairRepository.find({ where: { is_active: true } });
  }

  async findOne(id: string): Promise<TradingPair> {
    return this.tradingPairRepository.findOne({ where: { id } });
  }

  async findBySymbol(symbol: string): Promise<TradingPair> {
    return this.tradingPairRepository.findOne({ where: { symbol } });
  }

  async create(tradingPair: Partial<TradingPair>): Promise<TradingPair> {
    // Check if a trading pair with the same symbol already exists
    const existingPair = await this.findBySymbol(tradingPair.symbol);
    if (existingPair) {
      throw new ConflictException(`Trading pair with symbol '${tradingPair.symbol}' already exists`);
    }
    
    const newPair = this.tradingPairRepository.create(tradingPair);
    return this.tradingPairRepository.save(newPair);
  }

  async update(id: string, tradingPair: Partial<TradingPair>): Promise<TradingPair> {
    await this.tradingPairRepository.update(id, tradingPair);
    return this.findOne(id);
  }

  async delete(id: string): Promise<void> {
    await this.tradingPairRepository.delete(id);
  }

  async toggleActive(id: string, is_active: boolean): Promise<TradingPair> {
    await this.tradingPairRepository.update(id, { is_active });
    return this.findOne(id);
  }

  async seedDefaultPairs(): Promise<void> {
    const defaultPairs = [
      { symbol: 'BTC/USDT', is_active: true },
      { symbol: 'ETH/USDT', is_active: true },
      { symbol: 'SOL/USDT', is_active: true },
      { symbol: 'SUI/USDT', is_active: true },
    ];

    for (const pair of defaultPairs) {
      const existing = await this.findBySymbol(pair.symbol);
      if (!existing) {
        await this.create(pair);
        this.logger.log(`Created default trading pair: ${pair.symbol}`);
      }
    }
  }
}
