import { Controller, Post, Get, Body, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { InvestmentService } from '../../business/services/investment.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { UserDecorator } from '../decorator/user.decorator';
import { User } from '../../database/entities/user.entity';

@ApiTags('Investment')
@Controller('investment')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InvestmentController {
  constructor(private readonly investmentService: InvestmentService) {}

  @Get('deposit-info')
  @ApiOperation({ 
    summary: 'Get deposit information',
    description: 'Get system wallet address and minimum deposit amount' 
  })
  @ApiResponse({
    status: 200,
    description: 'Deposit information retrieved successfully'
  })
  async getDepositInfo() {
    const depositAddress = this.investmentService.getDepositAddress();
    const minimumAmount = this.investmentService.getMinimumInvestment();
    
    return {
      statusCode: 200,
      message: 'Deposit information retrieved successfully',
      data: {
        depositAddress,
        minimumAmount,
        currency: 'SOL'
      },
      timestamp: new Date().toISOString()
    };
  }

  @Post('deposit')
  @ApiOperation({ 
    summary: 'Create investment deposit',
    description: 'Create a new investment by verifying a Solana transaction' 
  })
  @ApiResponse({
    status: 201,
    description: 'Investment created successfully'
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid transaction'
  })
  async createDeposit(
    @UserDecorator() user: User,
    @Body() body: { txHash: string; }
  ) {
    console.log('💰 [InvestmentController] [createDeposit] user:', user.walletAddress, 'txHash:', body.txHash);
    
    // The amount parameter is no longer needed as we'll get it from the blockchain
    const investment = await this.investmentService.createInvestment(
      user.id,
      0, // This value will be ignored and replaced with actual amount from blockchain
      body.txHash
    );
    
    console.log('✅ [InvestmentController] [createDeposit] investment:', investment.id);
    
    return {
      statusCode: 201,
      message: 'Investment created successfully',
      data: investment,
      timestamp: new Date().toISOString()
    };
  }

  @Get('my-investments')
  @ApiOperation({ 
    summary: 'Get user investments',
    description: 'Get all investments for current user' 
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({
    status: 200,
    description: 'Investments retrieved successfully'
  })
  async getMyInvestments(
    @UserDecorator() user: User,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10
  ) {
    console.log('📊 [InvestmentController] [getMyInvestments] user:', user.walletAddress);
    
    const investments = await this.investmentService.getUserInvestments(
      user.id,
      page,
      limit
    );
    
    return {
      statusCode: 200,
      message: 'Investments retrieved successfully',
      data: investments.data,
      pagination: {
        page,
        limit,
        totalItems: investments.total,
        totalPages: Math.ceil(investments.total / limit)
      },
      timestamp: new Date().toISOString()
    };
  }

  @Get('dashboard')
  @ApiOperation({ 
    summary: 'Get investment dashboard',
    description: 'Get investment summary and earnings for current user' 
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard data retrieved successfully'
  })
  async getDashboard(@UserDecorator() user: User) {
    console.log('📈 [InvestmentController] [getDashboard] user:', user.walletAddress);
    
    const dashboard = await this.investmentService.getUserDashboard(user.id);
    
    return {
      statusCode: 200,
      message: 'Dashboard data retrieved successfully',
      data: dashboard,
      timestamp: new Date().toISOString()
    };
  }

  @Post('withdraw')
  @ApiOperation({ 
    summary: 'Request withdrawal',
    description: 'Request withdrawal of investment funds (24h processing time)' 
  })
  @ApiResponse({
    status: 201,
    description: 'Withdrawal request created successfully'
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid withdrawal amount or insufficient funds'
  })
  async requestWithdrawal(
    @UserDecorator() user: User,
    @Body() body: { amount: number; }
  ) {
    console.log('🏦 [InvestmentController] [requestWithdrawal] user:', user.walletAddress, 'amount:', body.amount);
    
    const withdrawal = await this.investmentService.requestWithdrawal(
      user.id,
      body.amount
    );
    
    console.log('✅ [InvestmentController] [requestWithdrawal] withdrawal:', withdrawal.id);
    
    return {
      statusCode: 201,
      message: 'Withdrawal request created successfully',
      data: withdrawal,
      timestamp: new Date().toISOString()
    };
  }

  @Get('withdrawals')
  @ApiOperation({ 
    summary: 'Get withdrawal history',
    description: 'Get withdrawal history for current user' 
  })
  @ApiResponse({
    status: 200,
    description: 'Withdrawal history retrieved successfully'
  })
  async getWithdrawals(@UserDecorator() user: User) {
    console.log('📋 [InvestmentController] [getWithdrawals] user:', user.walletAddress);
    
    const withdrawals = await this.investmentService.getUserWithdrawals(user.id);
    
    return {
      statusCode: 200,
      message: 'Withdrawal history retrieved successfully',
      data: withdrawals,
      timestamp: new Date().toISOString()
    };
  }
} 