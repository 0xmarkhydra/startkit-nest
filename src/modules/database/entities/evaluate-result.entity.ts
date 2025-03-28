import { Column, Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { EvaluateEntity } from './evaluate.entity';
import { UserEntity } from './user.entity';

@Entity('evaluate_results')
export class EvaluateResultEntity extends BaseEntity {
  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'member_id' })
  member: UserEntity;

  @Column({ name: 'member_id' })
  member_id: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'evaluator_id' })
  evaluator: UserEntity;

  @Column({ name: 'evaluator_id' })
  evaluator_id: string;

  @ManyToOne(() => EvaluateEntity)
  @JoinColumn({ name: 'evaluate_id' })
  evaluate: EvaluateEntity;

  @Column({ name: 'evaluate_id' })
  evaluate_id: string;

  @Column({ type: 'float' })
  point: number;

  @Column({ type: 'text', nullable: true })
  comment: string;

  @Column({ type: 'date' })
  evaluation_date: Date;

  @Column({ name: 'created_by' })
  created_by: string;
} 