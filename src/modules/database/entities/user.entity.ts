import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum UserRole {
  MEMBER = 'MEMBER',
  PM = 'PM',
  ADMIN = 'ADMIN',
}

export enum Department {
  HR = 'HR',
  BD = 'BD',
  DEV = 'DEV',
  TESTER = 'TESTER',
  DESIGN = 'DESIGN',
  AI = 'AI',
  PM = 'PM',
}

@Entity('users')
export class UserEntity extends BaseEntity {
  @Column({ unique: true, nullable: true })
  telegram_id: string;

  @Column({ nullable: true })
  username: string;

  @Column({ nullable: true })
  system_username: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true, type: 'enum', enum: UserRole, default: UserRole.MEMBER })
  role: UserRole;

  @Column({ nullable: true, type: 'enum', enum: Department, default: Department.DEV })
  department: Department;

  @Column({ nullable: true, unique: true })
  account: string;
}

