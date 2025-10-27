import { Injectable, NotFoundException } from '@nestjs/common';
import { UserWalletRepository } from '@/database/repositories';
import { UserWalletEntity } from '@/database/entities';
import { EncryptionService } from './encryption.service';
import { Wallet } from 'ethers';

@Injectable()
export class WalletService {
  // Hardcode chain ID: 8453 = Base (Base chain)
  private readonly defaultChainId = 8453;

  constructor(
    private userWalletRepository: UserWalletRepository,
    private encryptionService: EncryptionService,
  ) {}

  /**
   * Create a new wallet for a user
   * If wallet already exists, return existing wallet
   */
  async createWallet(userId: string): Promise<UserWalletEntity> {
    console.log(`🔍 [WalletService] [createWallet] Creating wallet for userId: ${userId}`);
    
    // Check if wallet already exists
    const existingWallet = await this.userWalletRepository.findOne({
      where: { userId, chainId: this.defaultChainId },
    });
    
    if (existingWallet) {
      console.log(`⚠️ [WalletService] [createWallet] Wallet already exists for userId: ${userId}`);
      return existingWallet;
    }
    
    // Generate new wallet
    const wallet = Wallet.createRandom();
    console.log(`✅ [WalletService] [createWallet] Generated new wallet with address: ${wallet.address}`);
    
    // Encrypt private key
    const { ciphertext } = this.encryptionService.encryptPrivateKey(
      wallet.privateKey,
    );
    
    // Create wallet entity
    const walletEntity = this.userWalletRepository.create({
      userId,
      chainId: this.defaultChainId,
      address: wallet.address,
      encPrivKey: ciphertext,
      custodian: 'aes_gcm',
    });
    
    // Save to database
    const savedWallet = await this.userWalletRepository.save(walletEntity);
    
    console.log(`✅ [WalletService] [createWallet] Wallet saved with id: ${savedWallet.id}`);
    
    return savedWallet;
  }

  /**
   * Get wallet by user ID
   */
  async getWalletByUserId(userId: string): Promise<UserWalletEntity> {
    console.log(`🔍 [WalletService] [getWalletByUserId] Getting wallet for userId: ${userId}`);
    
    const wallet = await this.userWalletRepository.findOne({
      where: { userId, chainId: this.defaultChainId },
    });
    
    if (!wallet) {
      console.log(`🔴 [WalletService] [getWalletByUserId] Wallet not found for userId: ${userId}`);
      throw new NotFoundException(`Wallet not found for user: ${userId}`);
    }
    
    console.log(`✅ [WalletService] [getWalletByUserId] Found wallet with address: ${wallet.address}`);
    
    return wallet;
  }

  /**
   * Get wallet by address
   */
  async getWalletByAddress(address: string): Promise<UserWalletEntity> {
    console.log(`🔍 [WalletService] [getWalletByAddress] Getting wallet for address: ${address}`);
    
    const wallet = await this.userWalletRepository.findOne({
      where: { address },
    });
    
    if (!wallet) {
      console.log(`🔴 [WalletService] [getWalletByAddress] Wallet not found for address: ${address}`);
      throw new NotFoundException(`Wallet not found for address: ${address}`);
    }
    
    console.log(`✅ [WalletService] [getWalletByAddress] Found wallet with userId: ${wallet.userId}`);
    
    return wallet;
  }

  /**
   * Get private key (decrypted) from wallet
   * WARNING: Only for admin use!
   */
  async getPrivateKey(userId: string): Promise<string> {
    console.log(`🔍 [WalletService] [getPrivateKey] Getting private key for userId: ${userId}`);
    
    const wallet = await this.getWalletByUserId(userId);
    
    // Decrypt private key
    const privateKey = this.encryptionService.decryptPrivateKey(
      wallet.encPrivKey,
    );
    
    console.log(`✅ [WalletService] [getPrivateKey] Private key decrypted successfully`);
    
    return privateKey;
  }

  /**
   * Get private key by address (decrypted) from wallet
   * WARNING: Only for admin use!
   */
  async getPrivateKeyByAddress(address: string): Promise<string> {
    console.log(`🔍 [WalletService] [getPrivateKeyByAddress] Getting private key for address: ${address}`);
    
    const wallet = await this.getWalletByAddress(address);
    
    // Decrypt private key
    const privateKey = this.encryptionService.decryptPrivateKey(
      wallet.encPrivKey,
    );
    
    console.log(`✅ [WalletService] [getPrivateKeyByAddress] Private key decrypted successfully`);
    
    return privateKey;
  }
}

