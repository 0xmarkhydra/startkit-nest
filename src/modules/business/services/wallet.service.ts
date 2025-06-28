import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../database/entities/user.entity';
import * as nacl from 'tweetnacl';
import bs58 from 'bs58';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService
  ) {}

  async verifyAndAuthenticate(walletAddress: string, signature: string, message: string) {
    console.log('🔍 [WalletService] [verifyAndAuthenticate] walletAddress:', walletAddress);
    
    try {
      // Verify signature
      const isValid = this.verifySignature(walletAddress, signature, message);
      
      if (!isValid) {
        throw new UnauthorizedException('Invalid wallet signature');
      }

      // Find or create user
      let user = await this.userRepository.findOne({ 
        where: { walletAddress } 
      });

      if (!user) {
        console.log('👤 [WalletService] [verifyAndAuthenticate] Creating new user');
        user = this.userRepository.create({ walletAddress });
        await this.userRepository.save(user);
      }

      // Update last login
      user.lastLoginAt = new Date();
      await this.userRepository.save(user);

      // Generate JWT token
      const payload = { 
        sub: user.id, 
        walletAddress: user.walletAddress 
      };
      const token = this.jwtService.sign(payload);

      console.log('✅ [WalletService] [verifyAndAuthenticate] User authenticated:', user.id);

      return {
        user: {
          id: user.id,
          walletAddress: user.walletAddress,
          createdAt: user.created_at
        },
        token
      };
    } catch (error) {
      console.log('🔴 [WalletService] [verifyAndAuthenticate] error:', error.message);
      throw new BadRequestException('Authentication failed');
    }
  }

  private verifySignature(walletAddress: string, signature: string, message: string): boolean {
    try {
      // Convert signature and message to Uint8Array
      // Signature from Phantom is in base64 format
      const signatureBytes = Uint8Array.from(
        atob(signature), c => c.charCodeAt(0)
      );
      const messageBytes = new TextEncoder().encode(message);
      const publicKeyBytes = bs58.decode(walletAddress);

      // Verify signature using tweetnacl
      return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
    } catch (error) {
      console.log('🔴 [WalletService] [verifySignature] error:', error.message);
      return false;
    }
  }

  async getUserProfile(userId: string) {
    console.log('👤 [WalletService] [getUserProfile] userId:', userId);
    
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['investments', 'withdrawalRequests']
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Calculate total investments and earnings
    const totalInvested = user.investments
      .filter(investment => investment.status === 'active' || investment.status === 'matured')
      .reduce((sum, investment) => sum + Number(investment.principalAmount), 0);

    const totalEarnings = user.investments
      .filter(investment => investment.status === 'active' || investment.status === 'matured')
      .reduce((sum, investment) => sum + investment.getCurrentInterest(), 0);

    const activeInvestments = user.investments.filter(
      investment => investment.status === 'active'
    ).length;

    const pendingWithdrawals = user.withdrawalRequests.filter(
      withdrawal => withdrawal.status === 'pending'
    ).length;

    return {
      id: user.id,
      walletAddress: user.walletAddress,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.created_at,
      stats: {
        totalInvested,
        totalEarnings,
        activeInvestments,
        pendingWithdrawals
      }
    };
  }
} 