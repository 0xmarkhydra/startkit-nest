import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { StakingRepository } from '../../database/repositories';
import { StakingEntity, StakingStatus } from '../../database/entities';
import { SolanaService } from './solana.service';

@Injectable()
export class StakingService {
  // Lãi suất 30% một năm
  private readonly ANNUAL_INTEREST_RATE = 0.3;
  // Số tiền tối thiểu để staking (1$)
  private readonly MIN_STAKING_AMOUNT = 1;

  constructor(
    private readonly stakingRepository: StakingRepository,
    private readonly solanaService: SolanaService,
  ) {}

  /**
   * Tạo staking mới
   */
  async createStaking(
    walletAddress: string,
    amount: number,
    transactionHash: string,
  ): Promise<StakingEntity> {
    // Kiểm tra số tiền tối thiểu
    if (amount < this.MIN_STAKING_AMOUNT) {
      throw new BadRequestException(
        `Minimum staking amount is $${this.MIN_STAKING_AMOUNT}`,
      );
    }

    // Xác minh giao dịch trên blockchain
    const isValidTransaction = await this.solanaService.verifyTransaction(
      transactionHash,
      amount,
      walletAddress,
    );

    if (!isValidTransaction) {
      throw new BadRequestException('Invalid transaction');
    }

    // Tính toán lãi suất và ngày kết thúc
    const startDate = new Date();
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 1); // Thêm 1 năm

    const expectedReturn = amount * (1 + this.ANNUAL_INTEREST_RATE);
    const dailyInterest = (amount * this.ANNUAL_INTEREST_RATE) / 365;

    // Tạo staking mới
    return this.stakingRepository.create({
      walletAddress,
      amount,
      expectedReturn,
      dailyInterest,
      startDate,
      endDate,
      transactionHash,
      status: StakingStatus.ACTIVE,
    });
  }

  /**
   * Lấy danh sách staking của một ví
   */
  async getStakingsByWallet(walletAddress: string): Promise<StakingEntity[]> {
    return this.stakingRepository.findByWalletAddress(walletAddress);
  }

  /**
   * Lấy danh sách staking đang hoạt động của một ví
   */
  async getActiveStakingsByWallet(walletAddress: string): Promise<StakingEntity[]> {
    return this.stakingRepository.findActiveByWalletAddress(walletAddress);
  }

  /**
   * Lấy thông tin staking theo ID
   */
  async getStakingById(id: string): Promise<StakingEntity> {
    const staking = await this.stakingRepository.findById(id);
    if (!staking) {
      throw new NotFoundException('Staking not found');
    }
    return staking;
  }

  /**
   * Rút tiền staking
   */
  async withdrawStaking(
    id: string,
    walletAddress: string,
    transactionHash: string,
  ): Promise<StakingEntity> {
    const staking = await this.getStakingById(id);

    // Kiểm tra xem staking có thuộc về ví này không
    if (staking.walletAddress !== walletAddress) {
      throw new BadRequestException('You are not the owner of this staking');
    }

    // Kiểm tra xem staking có đang hoạt động không
    if (staking.status !== StakingStatus.ACTIVE) {
      throw new BadRequestException('Staking is not active');
    }

    // Kiểm tra xem đã qua 24h chưa
    const now = new Date();
    const stakingStartTime = new Date(staking.startDate);
    const timeDiff = now.getTime() - stakingStartTime.getTime();
    const hoursDiff = timeDiff / (1000 * 60 * 60);

    if (hoursDiff < 24) {
      throw new BadRequestException(
        'You can only withdraw after 24 hours of staking',
      );
    }

    // Chuyển tiền từ vault về ví người dùng
    await this.solanaService.transferUSDC({
      fromWallet: this.solanaService.getVaultAddress(),
      toWallet: walletAddress,
      amount: staking.amount as unknown as number,
      token: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC token mint address on Solana
    });

    // Thực hiện rút tiền
    return this.stakingRepository.withdraw(id, transactionHash);
  }

  /**
   * Tính toán lợi nhuận hiện tại của staking
   */
  calculateCurrentEarnings(staking: StakingEntity): number {
    if (staking.status !== StakingStatus.ACTIVE) {
      return 0;
    }

    const now = new Date();
    const startDate = new Date(staking.startDate);
    const daysDiff = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    
    // Giới hạn số ngày tối đa là 365
    const effectiveDays = Math.min(daysDiff, 365);
    
    return staking.dailyInterest * effectiveDays;
  }
} 