import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum, IsNotEmpty, IsNumber, IsString } from 'class-validator';

export enum EvaluateTab {
  HR = 'HR',
  PM = 'PM',
}

export class EvaluatePointDto {
  @ApiProperty({ description: 'Order of evaluation item' })
  @IsNumber()
  @IsNotEmpty()
  order: number;

  @ApiProperty({ description: 'Point value' })
  @IsNumber()
  @IsNotEmpty()
  point: number;
}

export class UpdateEvaluateResultDto {
  @ApiProperty({ description: 'Member ID to evaluate' })
  @IsString()
  @IsNotEmpty()
  memberId: string;

  @ApiProperty({ description: 'Project ID to evaluate' })
  @IsString()
  @IsNotEmpty()
  createId: string;

  @ApiProperty({ type: [EvaluatePointDto], description: 'Array of evaluation points' })
  @IsArray()
  @IsNotEmpty()
  data: EvaluatePointDto[];

  @ApiProperty({ description: 'Tab of the evaluator', enum: EvaluateTab, required: false, default: EvaluateTab.PM })
  @IsEnum(EvaluateTab)
  tab: string;
} 