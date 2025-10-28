import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class IpWhitelistGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const clientIp = this.getClientIp(request);
    
    console.log(`🔍 [IpWhitelistGuard] Checking IP: ${clientIp}`);
    
    // Get IP whitelist from environment
    const whitelistString = this.configService.get<string>('IP_WHITELIST', '');
    
    // If whitelist is empty or '*', allow all (for development)
    if (!whitelistString || whitelistString === '*') {
      console.log(`⚠️ [IpWhitelistGuard] IP whitelist is disabled (empty or '*')`);
      return true;
    }
    
    // Parse whitelist (comma-separated IPs)
    const whitelist = whitelistString.split(',').map(ip => ip.trim());
    
    // Check if client IP is in whitelist
    const isAllowed = whitelist.includes(clientIp);
    
    if (!isAllowed) {
      console.log(`🔴 [IpWhitelistGuard] IP ${clientIp} is not in whitelist. Allowed IPs: ${whitelist.join(', ')}`);
      throw new ForbiddenException(`Access denied. Your IP (${clientIp}) is not whitelisted.`);
    }
    
    console.log(`✅ [IpWhitelistGuard] IP ${clientIp} is whitelisted`);
    return true;
  }

  /**
   * Get client IP from request
   * Handles proxy headers (X-Forwarded-For, X-Real-IP)
   */
  private getClientIp(request: Request): string {
    // Try X-Forwarded-For header (from proxy/load balancer)
    const xForwardedFor = request.headers['x-forwarded-for'];
    if (xForwardedFor) {
      const ips = Array.isArray(xForwardedFor) 
        ? xForwardedFor[0] 
        : xForwardedFor;
      return ips.split(',')[0].trim();
    }
    
    // Try X-Real-IP header
    const xRealIp = request.headers['x-real-ip'];
    if (xRealIp) {
      return Array.isArray(xRealIp) ? xRealIp[0] : xRealIp;
    }
    
    // Fallback to socket remote address
    return request.ip || request.socket.remoteAddress || 'unknown';
  }
}

