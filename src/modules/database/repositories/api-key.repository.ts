import { DataSource, Repository } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { ApiKeyEntity } from '../entities/api-key.entity';

export class ApiKeyRepository extends Repository<ApiKeyEntity> {
  constructor(@InjectDataSource() private dataSource: DataSource) {
    super(ApiKeyEntity, dataSource.createEntityManager());
  }

  async findByKey(key: string): Promise<ApiKeyEntity | null> {
    return this.findOne({ where: { key } });
  }

  async findByHashedKey(hashedKey: string): Promise<ApiKeyEntity | null> {
    return this.findOne({ where: { hashedKey } });
  }

  async findByUserId(userId: string): Promise<ApiKeyEntity[]> {
    return this.find({ 
      where: { userId, isActive: true },
      order: { created_at: 'DESC' }
    });
  }

  async incrementRequestCount(id: string): Promise<void> {
    await this.createQueryBuilder()
      .update(ApiKeyEntity)
      .set({ 
        totalRequests: () => 'total_requests + 1',
        lastUsedAt: new Date()
      })
      .where('id = :id', { id })
      .execute();
  }

  async deactivateKey(id: string): Promise<void> {
    await this.update(id, { isActive: false });
  }

  async findActiveKeyByUserId(userId: string, keyId: string): Promise<ApiKeyEntity | null> {
    return this.findOne({ 
      where: { 
        id: keyId, 
        userId, 
        isActive: true 
      } 
    });
  }

  async checkKeyExists(key: string): Promise<boolean> {
    const count = await this.count({ where: { key } });
    return count > 0;
  }
}