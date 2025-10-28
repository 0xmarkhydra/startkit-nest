import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AdminConfigRepository } from '@/database/repositories';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private adminConfigRepository: AdminConfigRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = this.extractApiKey(request);

    console.log(`🔍 [ApiKeyGuard] Checking API key: ${apiKey ? apiKey.substring(0, 10) + '...' : 'none'}`);

    if (!apiKey) {
      console.log(`🔴 [ApiKeyGuard] No API key provided`);
      throw new UnauthorizedException('API key is required. Please provide X-API-Key header.');
    }

    // Check if API key exists and is active in database
    const keyConfig = await this.adminConfigRepository.findOne({
      where: {
        key: 'api_keys',
      },
    });

    if (!keyConfig || !keyConfig.data) {
      console.log(`🔴 [ApiKeyGuard] No API keys configured in database`);
      throw new UnauthorizedException('API key authentication is not configured.');
    }

    // keyConfig.data should be an array of API keys with metadata
    const apiKeys = keyConfig.data as Array<{
      key: string;
      name: string;
      active: boolean;
      created_at: string;
    }>;

    // Find matching API key
    const matchingKey = apiKeys.find((k) => k.key === apiKey && k.active);

    if (!matchingKey) {
      console.log(`🔴 [ApiKeyGuard] Invalid or inactive API key`);
      throw new UnauthorizedException('Invalid or inactive API key.');
    }

    console.log(`✅ [ApiKeyGuard] Valid API key: ${matchingKey.name}`);

    // Attach key info to request for logging
    request['apiKeyInfo'] = {
      name: matchingKey.name,
      created_at: matchingKey.created_at,
    };

    return true;
  }

  /**
   * Extract API key from request header
   */
  private extractApiKey(request: Request): string | undefined {
    // Check X-API-Key header (preferred)
    const xApiKey = request.headers['x-api-key'];
    if (xApiKey) {
      return Array.isArray(xApiKey) ? xApiKey[0] : xApiKey;
    }

    // Check Authorization header with ApiKey scheme
    const authHeader = request.headers['authorization'];
    if (authHeader) {
      const match = authHeader.match(/^ApiKey\s+(.+)$/i);
      if (match) {
        return match[1];
      }
    }

    return undefined;
  }
}

