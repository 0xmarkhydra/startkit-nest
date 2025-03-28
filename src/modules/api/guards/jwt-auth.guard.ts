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
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);
    // if (process.env.APP_ENV === 'local') {
    //   return true;
    // }
    console.log('token', token.length);
    if (token) {
      try {
        const payload: TJWTPayload = await this.jwtService.verifyAsync(token, {
          secret: process.env.JWT_SECRET_KEY,
        });
        console.log('payload', payload);
        const user = await this.userRepository.findOne({ where: { telegram_id: payload.sub } });
        if (
          !user
        ) {
          throw {
            status_code: HttpStatus.UNAUTHORIZED,
            message: `Not found user`,
          };
        }
        request['user'] = { ...payload, sub: user.id, telegram_id: user.telegram_id };
      } catch (err) {
        throw new UnauthorizedException({
          status_code: HttpStatus.UNAUTHORIZED,
          ...err,
        });
      }
      return true;
    } else {
      throw new UnauthorizedException('Unauthorize');
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
