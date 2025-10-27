import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits

  constructor(private configService: ConfigService) {}

  /**
   * Encrypt private key using AES-256-GCM
   */
  encryptPrivateKey(privateKey: string): {
    ciphertext: Buffer;
    iv: Buffer;
    authTag: Buffer;
  } {
    const masterKey = this.getMasterKey();
    
    // Generate random IV (96 bits for GCM)
    const iv = crypto.randomBytes(12);
    
    const cipher = crypto.createCipheriv(this.algorithm, masterKey, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(privateKey, 'utf8'),
      cipher.final(),
    ]);
    
    const authTag = cipher.getAuthTag();
    
    // Combine IV + authTag + ciphertext
    const result = Buffer.concat([iv, authTag, encrypted]);
    
    return {
      ciphertext: result,
      iv,
      authTag,
    };
  }

  /**
   * Decrypt private key using AES-256-GCM
   */
  decryptPrivateKey(encryptedData: Buffer): string {
    const masterKey = this.getMasterKey();
    
    // Extract IV (first 12 bytes)
    const iv = encryptedData.subarray(0, 12);
    
    // Extract auth tag (next 16 bytes)
    const authTag = encryptedData.subarray(12, 28);
    
    // Extract ciphertext (rest)
    const ciphertext = encryptedData.subarray(28);
    
    const decipher = crypto.createDecipheriv(this.algorithm, masterKey, iv);
    decipher.setAuthTag(authTag);
    
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    
    return decrypted.toString('utf8');
  }

  /**
   * Get master key from environment variables
   */
  private getMasterKey(): Buffer {
    const masterKey = this.configService.get<string>('MASTER_KEY');
    
    if (!masterKey) {
      throw new Error('MASTER_KEY is not configured in environment variables');
    }
    
    // If master key is hex string, convert to buffer
    if (masterKey.match(/^[0-9a-fA-F]{64}$/)) {
      return Buffer.from(masterKey, 'hex');
    }
    
    // Otherwise hash the master key to get 32 bytes
    return crypto.createHash('sha256').update(masterKey).digest();
  }
}

