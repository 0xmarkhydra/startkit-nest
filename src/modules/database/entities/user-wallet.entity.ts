import { Entity, Column, Index, BeforeInsert, BeforeUpdate } from 'typeorm';
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

  /**
   * Normalize address to lowercase before insert
   */
  @BeforeInsert()
  normalizeAddressBeforeInsert() {
    if (this.address) {
      this.address = this.address.toLowerCase();
    }
  }

  /**
   * Normalize address to lowercase before update
   */
  @BeforeUpdate()
  normalizeAddressBeforeUpdate() {
    if (this.address) {
      this.address = this.address.toLowerCase();
    }
  }
}

