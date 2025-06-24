import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { StakingService } from '../../business/services';
import {
  CreateStakingDto,
  GetStakingsDto,
  StakingResponseDto,
  WithdrawStakingDto,
} from '../dtos';
import { StakingEntity } from '../../database/entities';

@ApiTags('Staking')
@Controller('staking')
export class StakingController {
  constructor(private readonly stakingService: StakingService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new staking' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Staking created successfully',
    type: StakingResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  async createStaking(
    @Body() createStakingDto: CreateStakingDto,
  ): Promise<StakingResponseDto> {
    const staking = await this.stakingService.createStaking(
      createStakingDto.walletAddress,
      createStakingDto.amount,
      createStakingDto.transactionHash,
    );

    return this.mapToResponseDto(staking);
  }

  @Post('withdraw')
  @ApiOperation({ summary: 'Withdraw staking' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Staking withdrawn successfully',
    type: StakingResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data or staking not eligible for withdrawal',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Staking not found',
  })
  async withdrawStaking(
    @Body() withdrawStakingDto: WithdrawStakingDto,
  ): Promise<StakingResponseDto> {
    const staking = await this.stakingService.withdrawStaking(
      withdrawStakingDto.stakingId,
      withdrawStakingDto.walletAddress,
      withdrawStakingDto.transactionHash,
    );

    return this.mapToResponseDto(staking);
  }

  @Get('wallet/:walletAddress')
  @ApiOperation({ summary: 'Get all stakings for a wallet' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of stakings',
    type: [StakingResponseDto],
  })
  async getStakingsByWallet(
    @Param('walletAddress') walletAddress: string,
  ): Promise<StakingResponseDto[]> {
    const stakings = await this.stakingService.getStakingsByWallet(walletAddress);
    return stakings.map((staking) => this.mapToResponseDto(staking));
  }

  @Get('active/:walletAddress')
  @ApiOperation({ summary: 'Get active stakings for a wallet' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of active stakings',
    type: [StakingResponseDto],
  })
  async getActiveStakingsByWallet(
    @Param('walletAddress') walletAddress: string,
  ): Promise<StakingResponseDto[]> {
    const stakings = await this.stakingService.getActiveStakingsByWallet(walletAddress);
    return stakings.map((staking) => this.mapToResponseDto(staking));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get staking by ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Staking details',
    type: StakingResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Staking not found',
  })
  async getStakingById(@Param('id') id: string): Promise<StakingResponseDto> {
    const staking = await this.stakingService.getStakingById(id);
    return this.mapToResponseDto(staking);
  }

  /**
   * Map StakingEntity to StakingResponseDto
   */
  private mapToResponseDto(staking: StakingEntity): StakingResponseDto {
    const currentEarnings = this.stakingService.calculateCurrentEarnings(staking);

    return {
      id: staking.id,
      walletAddress: staking.walletAddress,
      amount: staking.amount as unknown as number,
      expectedReturn: staking.expectedReturn as unknown as number,
      dailyInterest: staking.dailyInterest as unknown as number,
      currentEarnings,
      startDate: staking.startDate,
      endDate: staking.endDate,
      status: staking.status,
      transactionHash: staking.transactionHash,
      withdrawalTransactionHash: staking.withdrawalTransactionHash,
      withdrawalDate: staking.withdrawalDate,
      created_at: staking.created_at,
    };
  }
} 