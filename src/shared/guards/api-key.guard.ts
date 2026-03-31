import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  // TODO: Tích hợp với Database để kiểm tra key thật thay vì hardcode
  private validKeys = [
    'sk-lynxai-test-key-1',
    'sk-lynxai-test-key-2'
  ];

  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = this.extractKeyFromHeader(request);

    if (!apiKey) {
      throw new UnauthorizedException('API Key is missing');
    }

    if (!this.isValidApiKey(apiKey)) {
      throw new UnauthorizedException('Invalid API Key');
    }

    // Gắn thông tin apiKey vào request để có thể dùng về sau nếu cần
    request['apiKey'] = apiKey;

    return true;
  }

  private extractKeyFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }

  private isValidApiKey(apiKey: string): boolean {
    return this.validKeys.includes(apiKey);
  }
}
