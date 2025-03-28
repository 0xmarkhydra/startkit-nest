 
import { InjectDataSource } from '@nestjs/typeorm';
import { EvaluateEntity, EvaluateResultEntity } from '@/database/entities';
import { DataSource } from 'typeorm';
import { Repository } from 'typeorm';

export class EvaluateResultRepository extends Repository<EvaluateResultEntity> {
  constructor(@InjectDataSource() private dataSource: DataSource) {
    super(EvaluateResultEntity, dataSource.createEntityManager());
  }
} 