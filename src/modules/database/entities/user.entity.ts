import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('users')
export class UserEntity extends BaseEntity {
  @Column({ unique: true })
  @Index()
  email: string;

  @Column()
  password_hash: string;

  @Column({ nullable: true })
  username?: string;
}
