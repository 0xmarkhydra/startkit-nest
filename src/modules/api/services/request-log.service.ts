import {
  Injectable,
  NotFoundException,
  HttpStatus,
} from '@nestjs/common';
import { RequestLogRepository } from '@/database/repositories/request-log.repository';
import { RequestLogEntity } from '@/database/entities/request-log.entity';

@Injectable()
export class RequestLogService {
  constructor(private readonly requestLogRepository: RequestLogRepository) {}

  async findByUserId(
    userId: string,
    limit = 100,
    offset = 0,
  ): Promise<RequestLogEntity[]> {
    return this.requestLogRepository.findByUserId(userId, limit, offset);
  }

  async findById(userId: string, logId: string): Promise<RequestLogEntity> {
    const log = await this.requestLogRepository.findOne({
      where: { id: logId, userId },
    });

    if (!log) {
      throw new NotFoundException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Log not found',
      });
    }

    return log;
  }

  async getUserStats(
    userId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    totalRequests: number;
    totalTokens: number;
    totalCost: number;
    topModels: Array<{ model: string; count: number }>;
  }> {
    return this.requestLogRepository.getUserStats(userId, startDate, endDate);
  }

  async create(logData: Partial<RequestLogEntity>): Promise<RequestLogEntity> {
    const log = this.requestLogRepository.create(logData);
    return this.requestLogRepository.save(log);
  }

  // Calculate estimated cost based on model and token usage
  calculateEstimatedCost(model: string, promptTokens: number, completionTokens: number): number {
    // Cost per 1M tokens (in USD) - these are example rates
    const modelPricing: Record<string, { input: number; output: number }> = {
      'moonshotai/kimi-k2.5': { input: 2.0, output: 8.0 },
      'openai/gpt-4o': { input: 5.0, output: 15.0 },
      'anthropic/claude-opus-4.6': { input: 15.0, output: 75.0 },
      'deepseek/deepseek-r1': { input: 0.55, output: 2.19 },
      'google/gemini-3-pro-preview': { input: 3.5, output: 10.5 },
    };

    const pricing = modelPricing[model] || { input: 2.0, output: 8.0 }; // Default pricing

    const inputCost = (promptTokens / 1000000) * pricing.input;
    const outputCost = (completionTokens / 1000000) * pricing.output;

    return Number((inputCost + outputCost).toFixed(6));
  }
}