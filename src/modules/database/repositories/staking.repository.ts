import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StakingEntity, StakingStatus } from '../entities/staking.entity';

@Injectable()
export class StakingRepository {
  constructor(
    @InjectRepository(StakingEntity)
    private stakingRepository: Repository<StakingEntity>,
  ) {}

  async create(staking: Partial<StakingEntity>): Promise<StakingEntity> {
    const newStaking = this.stakingRepository.create(staking);
    return this.stakingRepository.save(newStaking);
  }

  async findByWalletAddress(walletAddress: string): Promise<StakingEntity[]> {
    return this.stakingRepository.find({
      where: { walletAddress },
      order: { created_at: 'DESC' },
    });
  }

  async findActiveByWalletAddress(walletAddress: string): Promise<StakingEntity[]> {
    return this.stakingRepository.find({
      where: { walletAddress, status: StakingStatus.ACTIVE },
      order: { created_at: 'DESC' },
    });
  }

  async findById(id: string): Promise<StakingEntity> {
    return this.stakingRepository.findOne({ where: { id } });
  }

  async update(id: string, data: Partial<StakingEntity>): Promise<StakingEntity> {
    await this.stakingRepository.update(id, data);
    return this.findById(id);
  }

  async withdraw(id: string, transactionHash: string): Promise<StakingEntity> {
    const staking = await this.findById(id);
    if (!staking) {
      return null;
    }

    staking.status = StakingStatus.WITHDRAWN;
    staking.withdrawalDate = new Date();
    staking.withdrawalTransactionHash = transactionHash;

    return this.stakingRepository.save(staking);
  }
} 