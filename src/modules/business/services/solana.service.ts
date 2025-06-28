import { Injectable, BadRequestException } from '@nestjs/common';
import { Connection, PublicKey, ConfirmedSignatureInfo } from '@solana/web3.js';

@Injectable()
export class SolanaService {
  private connection: Connection;
  private systemWalletAddress: string = 'HPfcPDMfcMsYdhiF8Z8iYwP6M9dTQdZJxrwK1kDiJCWq';
  private MIN_AMOUNT_SOL: number = 0.1;

  constructor() {
    // Connect to Solana mainnet
    this.connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
  }

  /**
   * Verify a Solana transaction
   * @param txHash Transaction hash/signature
   * @param expectedSender Sender wallet address
   * @param expectedAmount Expected amount in SOL
   * @returns Transaction details if valid
   */
  async verifyTransaction(txHash: string, expectedSender: string): Promise<{
    isValid: boolean;
    amount: number;
    sender: string;
    receiver: string;
    timestamp: number;
    error?: string;
  }> {
    try {
      console.log('🔍 [SolanaService] [verifyTransaction] Verifying tx:', txHash);

      // Get transaction details
      const tx = await this.connection.getTransaction(txHash, {
        maxSupportedTransactionVersion: 0,
      });

      if (!tx) {
        console.log('🔴 [SolanaService] [verifyTransaction] Transaction not found');
        return {
          isValid: false,
          amount: 0,
          sender: '',
          receiver: '',
          timestamp: 0,
          error: 'Transaction not found'
        };
      }

      // Extract transaction details
      const accountKeys = tx.transaction.message.getAccountKeys 
        ? tx.transaction.message.getAccountKeys().keySegments().flat()
        : tx.transaction.message.staticAccountKeys;
        
      const sender = accountKeys[0].toString();
      const receiver = tx.meta.postBalances.length > 1 
        ? accountKeys[1].toString()
        : '';
      
      // Verify receiver is our system wallet
      if (receiver !== this.systemWalletAddress) {
        console.log('🔴 [SolanaService] [verifyTransaction] Invalid receiver:', receiver);
        return {
          isValid: false,
          amount: 0,
          sender,
          receiver,
          timestamp: tx.blockTime * 1000 || 0,
          error: 'Transaction not sent to system wallet'
        };
      }

      // Verify sender
      if (sender !== expectedSender) {
        console.log('🔴 [SolanaService] [verifyTransaction] Invalid sender:', sender);
        return {
          isValid: false,
          amount: 0,
          sender,
          receiver,
          timestamp: tx.blockTime * 1000 || 0,
          error: 'Transaction not sent from user wallet'
        };
      }

      // Calculate amount in SOL
      const preBalance = tx.meta.preBalances[1];
      const postBalance = tx.meta.postBalances[1];
      const amountLamports = postBalance - preBalance;
      const amountSOL = amountLamports / 1_000_000_000; // Convert lamports to SOL

      // Verify minimum amount
      if (amountSOL < this.MIN_AMOUNT_SOL) {
        console.log('🔴 [SolanaService] [verifyTransaction] Amount too small:', amountSOL);
        return {
          isValid: false,
          amount: amountSOL,
          sender,
          receiver,
          timestamp: tx.blockTime * 1000 || 0,
          error: `Minimum investment is ${this.MIN_AMOUNT_SOL} SOL`
        };
      }

      console.log('✅ [SolanaService] [verifyTransaction] Transaction valid:', {
        sender,
        receiver,
        amount: amountSOL
      });

      return {
        isValid: true,
        amount: amountSOL,
        sender,
        receiver,
        timestamp: tx.blockTime * 1000 || 0
      };
    } catch (error) {
      console.log('🔴 [SolanaService] [verifyTransaction] Error:', error.message);
      return {
        isValid: false,
        amount: 0,
        sender: '',
        receiver: '',
        timestamp: 0,
        error: `Error verifying transaction: ${error.message}`
      };
    }
  }

  /**
   * Get the system wallet address
   */
  getSystemWalletAddress(): string {
    return this.systemWalletAddress;
  }

  /**
   * Get the minimum investment amount in SOL
   */
  getMinimumInvestmentAmount(): number {
    return this.MIN_AMOUNT_SOL;
  }
} 