import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { AdminConfigRepository, UserRepository } from '@/database/repositories';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { TJWTPayload } from '@/shared/types';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
@Injectable()
export class UserService {
  @Inject(UserRepository)
  private readonly userRepository: UserRepository;

  @Inject(AuthService)
  private readonly authService: AuthService;

  async verifyToken(token: string) {
    const payload: TJWTPayload = await this.authService.verifyAccessToken(token);
    let user = await this.userRepository.findOne({ where: { telegram_id: payload.sub } });
    if (!user) {
        user = await this.userRepository.save({
            telegram_id: payload.sub,
            username: payload.username,
        });
    }
    return user;
  }
 
}
