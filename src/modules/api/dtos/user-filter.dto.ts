import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginateDto } from '@/shared/pagination/paginate.dto';
import { Department, UserRole } from '@/database/entities';

export class UserFilterDto extends PaginateDto {
  @ApiPropertyOptional({
    enum: Department,
    description: 'Filter users by department',
  })
  @IsOptional()
  @IsEnum(Department)
  department?: Department;

  @ApiPropertyOptional({
    enum: UserRole,
    description: 'Filter users by role',
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
} 