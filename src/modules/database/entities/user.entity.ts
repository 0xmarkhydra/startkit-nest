import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('users')
export class UserEntity extends BaseEntity {
  @Column({ unique: true, nullable: true })
  telegram_id: string;

  @Column({ unique: true, nullable: true })
  telegram_username: string;

  @Column({ nullable: true })
  username: string;

  @Column({ nullable: true })
  email: string;
}
