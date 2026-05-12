import { UserRepository } from '@/database/repositories';
import { TJWTPayload } from '@/shared/types';
import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  @Inject(UserRepository)
  private userRepository: UserRepository;

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (process.env.APP_ENV === 'local') {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromCookie(request);

    if (!token) {
      throw new UnauthorizedException('No authentication token');
    }

    try {
      const payload: TJWTPayload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('auth.jwt.jwt_secret_key'),
      });

      if (!(await this.userRepository.exists({ where: { id: payload.sub } }))) {
        throw { status_code: HttpStatus.UNAUTHORIZED, message: 'User not found' };
      }

      request['user'] = { ...payload };
    } catch (err) {
      throw new UnauthorizedException({
        status_code: HttpStatus.UNAUTHORIZED,
        ...err,
      });
    }

    return true;
  }

  private extractTokenFromCookie(request: Request): string | undefined {
    return request.cookies?.['access_token'];
  }
}
