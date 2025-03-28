import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsNumber, IsString } from 'class-validator';

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

  // @ApiProperty({ description: 'Role of the evaluator' })
  // @IsString()
  // @IsNotEmpty()
  // role: string;
} 