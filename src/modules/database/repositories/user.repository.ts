import { DataSource, Repository } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { UserEntity } from '../entities/user.entity';

export class UserRepository extends Repository<UserEntity> {
  constructor(@InjectDataSource() private dataSource: DataSource) {
    super(UserEntity, dataSource.createEntityManager());
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.findOne({ where: { email } });
  }

  async findById(id: string): Promise<UserEntity | null> {
    return this.findOne({ where: { id } });
  }

  async findActiveUsers(): Promise<UserEntity[]> {
    return this.find({ where: { isActive: true } });
  }

  async deactivateUser(id: string): Promise<void> {
    await this.update(id, { isActive: false });
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.update(id, { updated_at: new Date() });
  }
}