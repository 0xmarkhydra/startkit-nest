import { DataSource, Repository, Between } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { RequestLogEntity } from '../entities/request-log.entity';

export class RequestLogRepository extends Repository<RequestLogEntity> {
  constructor(@InjectDataSource() private dataSource: DataSource) {
    super(RequestLogEntity, dataSource.createEntityManager());
  }

  async findByUserId(userId: string, limit = 100, offset = 0): Promise<RequestLogEntity[]> {
    return this.find({
      where: { userId },
      order: { created_at: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  async findByApiKeyId(apiKeyId: string, limit = 100, offset = 0): Promise<RequestLogEntity[]> {
    return this.find({
      where: { apiKeyId },
      order: { created_at: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  async getUserStats(userId: string, startDate?: Date, endDate?: Date): Promise<{
    totalRequests: number;
    totalTokens: number;
    totalCost: number;
    topModels: Array<{ model: string; count: number }>;
  }> {
    const query = this.createQueryBuilder('log')
      .select([
        'COUNT(log.id) as "totalRequests"',
        'SUM(log.totalTokens) as "totalTokens"',
        'SUM(log.estimatedCost) as "totalCost"',
      ])
      .where('log.userId = :userId', { userId });

    if (startDate && endDate) {
      query.andWhere('log.created_at BETWEEN :startDate AND :endDate', { startDate, endDate });
    }

    const statsResult = await query.getRawOne();

    // Get top models
    const topModelsQuery = this.createQueryBuilder('log')
      .select(['log.model', 'COUNT(log.id) as count'])
      .where('log.userId = :userId', { userId })
      .andWhere('log.model IS NOT NULL')
      .groupBy('log.model')
      .orderBy('count', 'DESC')
      .limit(5);

    if (startDate && endDate) {
      topModelsQuery.andWhere('log.created_at BETWEEN :startDate AND :endDate', { startDate, endDate });
    }

    const topModelsResult = await topModelsQuery.getRawMany();

    return {
      totalRequests: parseInt(statsResult?.totalRequests || '0', 10),
      totalTokens: parseFloat(statsResult?.totalTokens || '0'),
      totalCost: parseFloat(statsResult?.totalCost || '0'),
      topModels: topModelsResult.map(row => ({
        model: row.model,
        count: parseInt(row.count, 10),
      })),
    };
  }

  async getRecentRequests(userId: string, hours = 24): Promise<RequestLogEntity[]> {
    const date = new Date();
    date.setHours(date.getHours() - hours);

    return this.find({
      where: {
        userId,
        created_at: Between(date, new Date()),
      },
      order: { created_at: 'DESC' },
      take: 50,
    });
  }

  async getApiKeyStats(apiKeyId: string): Promise<{
    totalRequests: number;
    lastUsedAt: Date | null;
    averageTokens: number;
  }> {
    const result = await this.createQueryBuilder('log')
      .select([
        'COUNT(log.id) as "totalRequests"',
        'MAX(log.created_at) as "lastUsedAt"',
        'AVG(log.totalTokens) as "averageTokens"',
      ])
      .where('log.apiKeyId = :apiKeyId', { apiKeyId })
      .getRawOne();

    return {
      totalRequests: parseInt(result?.totalRequests || '0', 10),
      lastUsedAt: result?.lastUsedAt ? new Date(result.lastUsedAt) : null,
      averageTokens: parseFloat(result?.averageTokens || '0'),
    };
  }
}