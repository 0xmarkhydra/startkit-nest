import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('user_wallets')
export class UserWalletEntity extends BaseEntity {
  @Column()
  @Index()
  userId: string;

  @Column()
  @Index()
  chainId: number;

  @Column({ unique: true })
  @Index()
  address: string;

  @Column({ type: 'bytea' })
  encPrivKey: Buffer;

  @Column({ nullable: true, type: 'bytea' })
  encMeta?: Buffer;

  @Column({ default: 'aes_gcm' })
  custodian: string;
}

