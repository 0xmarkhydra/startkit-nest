import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('users')
export class UserEntity extends BaseEntity {
  @Column({ unique: true, nullable: true })
  username?: string;

  @Column({ nullable: true })
  email?: string;

  @Column({ unique: true })
  @Index()
  address: string;

  @Column({ nullable: true })
  nonce?: string;
}
