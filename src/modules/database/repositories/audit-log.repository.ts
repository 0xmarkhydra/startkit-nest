import { DataSource, Repository } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { AuditLogEntity } from '../entities/audit-log.entity';

export class AuditLogRepository extends Repository<AuditLogEntity> {
  constructor(@InjectDataSource() private dataSource: DataSource) {
    super(AuditLogEntity, dataSource.createEntityManager());
  }
}

