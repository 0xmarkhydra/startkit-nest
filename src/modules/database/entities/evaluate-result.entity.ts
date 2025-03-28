import { Column, Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { UserEntity } from './user.entity';

@Entity('evaluate_results')
export class EvaluateResultEntity extends BaseEntity {
  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'member_id' })
  member: UserEntity;

  @Column({ name: 'member_id' })
  member_id: string;

  @Column({ type: 'simple-json', nullable: true, default: {} })
  results: any;

  @Column({ name: 'create_id' })
  create_id: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'create_id' })
  create: UserEntity;

  @Column({ name: 'user_id' })
  user_id: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}