import { Column, Entity } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum EvaluateType {
  PM = 'PM',
  HR = 'HR',
}

export enum EvaluateCategory {
    // ĐIỂM THÀNH TÍCH
    ACHIEVEMENT_POINTS = 'ACHIEVEMENT_POINTS',
    // Điểm ý thức thái độ 
    ATTITUDE_POINTS = 'ATTITUDE_POINTS',
    // Điểm chuyên cần
    SPECIAL_REQUIREMENTS = 'SPECIAL_REQUIREMENTS',
}

@Entity('evaluates')
export class EvaluateEntity extends BaseEntity {
  @Column({ nullable: true })
  name: string;

  @Column({ type: 'int' })
  max_point: number;

  @Column({ type: 'enum', enum: EvaluateType, default: EvaluateType.PM, nullable: true })
  type: EvaluateType;

  @Column({ type: 'enum', enum: EvaluateCategory, default: EvaluateCategory.ACHIEVEMENT_POINTS, nullable: true })
  category: EvaluateCategory;

  @Column({ type: 'int', nullable: true, unique: true })
  order: number;
}