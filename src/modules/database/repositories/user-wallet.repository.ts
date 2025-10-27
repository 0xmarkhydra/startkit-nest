import { DataSource, Repository } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { UserWalletEntity } from '../entities/user-wallet.entity';

export class UserWalletRepository extends Repository<UserWalletEntity> {
  constructor(@InjectDataSource() private dataSource: DataSource) {
    super(UserWalletEntity, dataSource.createEntityManager());
  }
}

