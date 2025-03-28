import { DataSource, Repository } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { EvaluateEntity } from '@/database/entities';

export class EvaluateRepository extends Repository<EvaluateEntity> {
  constructor(@InjectDataSource() private dataSource: DataSource) {
    super(EvaluateEntity, dataSource.createEntityManager());
  }

  async findOneById(id: string): Promise<EvaluateEntity> {
    return this.createQueryBuilder('evaluate')
      .where('evaluate.id = :id', { id })
      .limit(1)
      .getOne();
  }

  async findByType(type: string): Promise<EvaluateEntity[]> {
    return this.createQueryBuilder('evaluate')
      .where('evaluate.type = :type', { type })
      .getMany();
  }
} 