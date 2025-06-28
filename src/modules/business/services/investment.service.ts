import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Investment, InvestmentStatus } from '../../database/entities/investment.entity';
import { WithdrawalRequest, WithdrawalStatus } from '../../database/entities/withdrawal-request.entity';
import { User } from '../../database/entities/user.entity';
import { SolanaService } from './solana.service';

@Injectable()
export class InvestmentService {
  constructor(
    @InjectRepository(Investment)
    private readonly investmentRepository: Repository<Investment>,
    @InjectRepository(WithdrawalRequest)
    private readonly withdrawalRepository: Repository<WithdrawalRequest>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly solanaService: SolanaService
  ) {}

  /**
   * Get the system wallet address for deposits
   */
  getDepositAddress(): string {
    return this.solanaService.getSystemWalletAddress();
  }

  /**
   * Get minimum investment amount in SOL
   */
  getMinimumInvestment(): number {
    return this.solanaService.getMinimumInvestmentAmount();
  }

  /**
   * Create a new investment by verifying a Solana transaction
   */
  async createInvestment(userId: string, amount: number, txHash: string) {
    console.log('💰 [InvestmentService] [createInvestment] userId:', userId, 'txHash:', txHash);
    
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Verify transaction on Solana blockchain
    const txVerification = await this.solanaService.verifyTransaction(txHash, user.walletAddress);
    
    if (!txVerification.isValid) {
      throw new BadRequestException(`Invalid transaction: ${txVerification.error}`);
    }

    // Use the actual amount from blockchain, not the client-provided amount
    const solAmount = txVerification.amount;
    
    console.log('💰 [InvestmentService] [createInvestment] Verified amount:', solAmount, 'SOL');

    const startDate = new Date();
    const maturityDate = new Date();
    maturityDate.setFullYear(startDate.getFullYear() + 1); // 1 year from now

    const investment = this.investmentRepository.create({
      userId,
      principalAmount: solAmount, // Use actual SOL amount from blockchain
      interestRate: 0.30, // 30%
      termDays: 365,
      startDate,
      maturityDate,
      status: InvestmentStatus.ACTIVE,
      depositTxHash: txHash,
      accruedInterest: 0,
      lastInterestCalculation: startDate
    });

    const savedInvestment = await this.investmentRepository.save(investment);
    
    console.log('✅ [InvestmentService] [createInvestment] investment created:', savedInvestment.id);
    
    return savedInvestment;
  }

  async getUserInvestments(userId: string, page: number = 1, limit: number = 10) {
    console.log('📊 [InvestmentService] [getUserInvestments] userId:', userId);
    
    const [investments, total] = await this.investmentRepository.findAndCount({
      where: { userId },
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit
    });

    // Calculate current interest for each investment
    const investmentsWithInterest = investments.map(investment => ({
      ...investment,
      currentInterest: investment.getCurrentInterest(),
      totalValue: Number(investment.principalAmount) + investment.getCurrentInterest(),
      daysRemaining: Math.max(0, Math.ceil((investment.maturityDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    }));

    return {
      data: investmentsWithInterest,
      total
    };
  }

  async getUserDashboard(userId: string) {
    console.log('📈 [InvestmentService] [getUserDashboard] userId:', userId);
    
    const investments = await this.investmentRepository.find({
      where: { userId },
      order: { created_at: 'DESC' }
    });

    const withdrawals = await this.withdrawalRepository.find({
      where: { userId },
      order: { created_at: 'DESC' },
      take: 5
    });

    // Calculate summary statistics
    const totalInvested = investments
      .filter(i => i.status !== InvestmentStatus.CANCELLED)
      .reduce((sum, i) => sum + Number(i.principalAmount), 0);

    const totalEarnings = investments
      .filter(i => i.status === InvestmentStatus.ACTIVE || i.status === InvestmentStatus.MATURED)
      .reduce((sum, i) => sum + i.getCurrentInterest(), 0);

    const activeInvestments = investments.filter(i => i.status === InvestmentStatus.ACTIVE);
    const maturedInvestments = investments.filter(i => i.isMatured() && i.status === InvestmentStatus.ACTIVE);

    const pendingWithdrawals = withdrawals.filter(w => w.status === WithdrawalStatus.PENDING);
    const totalPendingAmount = pendingWithdrawals.reduce((sum, w) => sum + Number(w.amount), 0);

    // Calculate daily interest rate
    const dailyInterestRate = 0.30 / 365; // 30% annual / 365 days
    const dailyEarnings = totalInvested * dailyInterestRate;

    return {
      summary: {
        totalInvested,
        totalEarnings,
        totalValue: totalInvested + totalEarnings,
        dailyEarnings,
        activeInvestments: activeInvestments.length,
        maturedInvestments: maturedInvestments.length,
        pendingWithdrawals: pendingWithdrawals.length,
        totalPendingAmount
      },
      recentInvestments: investments.slice(0, 5).map(investment => ({
        ...investment,
        currentInterest: investment.getCurrentInterest(),
        totalValue: Number(investment.principalAmount) + investment.getCurrentInterest()
      })),
      recentWithdrawals: withdrawals
    };
  }

  async requestWithdrawal(userId: string, amount: number) {
    console.log('🏦 [InvestmentService] [requestWithdrawal] userId:', userId, 'amount:', amount);
    
    if (amount <= 0) {
      throw new BadRequestException('Withdrawal amount must be greater than 0');
    }

    // Check user's available balance
    const investments = await this.investmentRepository.find({
      where: { userId, status: InvestmentStatus.ACTIVE }
    });

    const totalAvailable = investments.reduce((sum, investment) => {
      return sum + Number(investment.principalAmount) + investment.getCurrentInterest();
    }, 0);

    if (amount > totalAvailable) {
      throw new BadRequestException('Insufficient balance');
    }

    const requestedAt = new Date();
    const processAt = new Date();
    processAt.setHours(processAt.getHours() + 24); // 24 hours later

    const withdrawal = this.withdrawalRepository.create({
      userId,
      amount,
      status: WithdrawalStatus.PENDING,
      requestedAt,
      processAt,
      notes: `Withdrawal request for $${amount}`
    });

    const savedWithdrawal = await this.withdrawalRepository.save(withdrawal);
    
    console.log('✅ [InvestmentService] [requestWithdrawal] withdrawal created:', savedWithdrawal.id);
    
    return {
      ...savedWithdrawal,
      hoursUntilProcessing: Math.ceil((processAt.getTime() - Date.now()) / (1000 * 60 * 60))
    };
  }

  async getUserWithdrawals(userId: string) {
    console.log('📋 [InvestmentService] [getUserWithdrawals] userId:', userId);
    
    const withdrawals = await this.withdrawalRepository.find({
      where: { userId },
      order: { created_at: 'DESC' },
      take: 20
    });

    return withdrawals.map(withdrawal => ({
      ...withdrawal,
      canCancel: withdrawal.status === WithdrawalStatus.PENDING && !withdrawal.isReadyToProcess(),
      hoursUntilProcessing: withdrawal.status === WithdrawalStatus.PENDING ? 
        Math.max(0, Math.ceil((withdrawal.processAt.getTime() - Date.now()) / (1000 * 60 * 60))) : 0
    }));
  }
} 