import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Inject } from '@nestjs/common';
import { Request } from 'express';
import { ApiKeyService } from '@/api/services/api-key.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    @Inject(ApiKeyService)
    private readonly apiKeyService: ApiKeyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = this.extractKeyFromHeader(request);

    if (!apiKey) {
      throw new UnauthorizedException('API Key is missing');
    }

    const validationResult = await this.apiKeyService.validateKey(apiKey);

    if (!validationResult.isValid) {
      throw new UnauthorizedException('Invalid API Key');
    }

    // Attach apiKey info to request for later use
    request['apiKey'] = apiKey;
    request['apiKeyId'] = validationResult.apiKeyId;
    request['userId'] = validationResult.userId;

    return true;
  }

  private extractKeyFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}