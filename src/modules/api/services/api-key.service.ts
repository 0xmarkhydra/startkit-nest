import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  HttpStatus,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import { ApiKeyRepository } from '@/database/repositories/api-key.repository';
import { CreateApiKeyDto, ApiKeyResponseDto } from '../dtos/api-key';

@Injectable()
export class ApiKeyService {
  constructor(private readonly apiKeyRepository: ApiKeyRepository) {}

  async findAllByUserId(userId: string): Promise<Omit<ApiKeyResponseDto, 'key'>[]> {
    const apiKeys = await this.apiKeyRepository.findByUserId(userId);
    return apiKeys.map((key) => this.mapToResponseDto(key, false));
  }

  async create(
    userId: string,
    createApiKeyDto: CreateApiKeyDto,
  ): Promise<ApiKeyResponseDto> {
    // Generate unique key
    const prefix = createApiKeyDto.prefix || `user-${userId.slice(0, 8)}`;
    const uuid = uuidv4();
    const key = `sk-lynxai-${prefix}-${uuid}`;

    // Hash the key for storage
    const hashedKey = this.hashKey(key);

    // Create API key entity
    const apiKey = this.apiKeyRepository.create({
      key: key, // Store original key for reference, hash for verification
      hashedKey,
      name: createApiKeyDto.name,
      prefix,
      userId,
      isActive: true,
      totalRequests: 0,
      expiresAt: createApiKeyDto.expiresAt
        ? new Date(createApiKeyDto.expiresAt)
        : null,
    });

    const savedApiKey = await this.apiKeyRepository.save(apiKey);

    // Return with the full key (only shown once)
    return this.mapToResponseDto(savedApiKey, true);
  }

  async delete(userId: string, keyId: string): Promise<void> {
    const apiKey = await this.apiKeyRepository.findActiveKeyByUserId(
      userId,
      keyId,
    );

    if (!apiKey) {
      throw new NotFoundException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'API key not found',
      });
    }

    await this.apiKeyRepository.deactivateKey(keyId);
  }

  async validateKey(key: string): Promise<{
    isValid: boolean;
    userId?: string;
    apiKeyId?: string;
  }> {
    const hashedKey = this.hashKey(key);
    const apiKey = await this.apiKeyRepository.findByHashedKey(hashedKey);

    if (!apiKey) {
      return { isValid: false };
    }

    // Check if key is active
    if (!apiKey.isActive) {
      return { isValid: false };
    }

    // Check if key is expired
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return { isValid: false };
    }

    // Update usage stats
    await this.apiKeyRepository.incrementRequestCount(apiKey.id);

    return {
      isValid: true,
      userId: apiKey.userId,
      apiKeyId: apiKey.id,
    };
  }

  private hashKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  private mapToResponseDto(
    apiKey: any,
    includeKey: boolean,
  ): ApiKeyResponseDto {
    return {
      id: apiKey.id,
      name: apiKey.name,
      key: includeKey ? apiKey.key : undefined,
      prefix: apiKey.prefix,
      totalRequests: apiKey.totalRequests,
      lastUsedAt: apiKey.lastUsedAt,
      isActive: apiKey.isActive,
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.created_at,
      updatedAt: apiKey.updated_at,
    };
  }
}