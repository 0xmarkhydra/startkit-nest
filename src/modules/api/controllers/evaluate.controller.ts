import { AuthService } from '@/business/services/auth.service';
import { UserRepository } from '@/database/repositories';
import { ResponseMessage } from '@/shared/decorators/response-message.decorator';
import { ApiBaseResponse } from '@/shared/swagger/decorator/api-response.decorator';
import {
  Controller,
  ForbiddenException,
  Get,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
  Put,
  Body,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { UserService } from '@/business/services/user.service';
import { EvaluateService } from '@/business/services/evaluate.service';
import { GetUser } from '../../auth/decorators/get-user.decorator';
import { UserEntity, UserRole } from '@/database/entities';
import { EvaluateTab, UpdateEvaluateResultDto } from '../../business/dtos/evaluate.dto';
import { TJWTPayload } from '@/shared/types';
import { CurrentUser } from '@/shared/decorators/user.decorator';

@ApiTags('Evaluate')
@Controller('evaluate')
@ApiBearerAuth()
export class EvaluateController {
  constructor(
    private readonly evaluateService: EvaluateService
) {}

  @Get('data-excel')
  @ApiOperation({ summary: 'Get data excel' })
  async getDataExcel() {
    return this.evaluateService.getDataExcel();
  }

  @Put('update')
  @ApiOperation({ summary: 'Update evaluate result' })
  @ApiResponse({ status: 200, description: 'Update evaluate result successfully' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async updateEvaluateResult(
    @CurrentUser() user: TJWTPayload,
    @Body() updateDto: UpdateEvaluateResultDto
  ): Promise<{ success: boolean }> {
    console.log(`🔄 EvaluateController updateEvaluateResult:`, { user, updateDto });
    const result = await this.evaluateService.updateEvaluateResult(
      user.sub,
      updateDto.memberId,
      updateDto.data,
      updateDto.createId,
      updateDto.tab as EvaluateTab
    );

    return { success: result };
  }
}
