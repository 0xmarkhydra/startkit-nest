import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { AdminConfigRepository, UserRepository } from '@/database/repositories';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { TJWTPayload } from '@/shared/types';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  @Inject(UserRepository)
  private readonly userRepository: UserRepository;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async getAccessToken(payload: TJWTPayload) {
    const expiresIn = 60 * 60 * 24 * 7;
    return await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_SECRET_KEY,
      expiresIn: expiresIn,
    });
  }

  async verifyAccessToken(token: string) {
    return await this.jwtService.verifyAsync(token, {
      secret: process.env.JWT_SECRET_KEY,
    });
  }

  async onApplicationBootstrap() {
    console.log('🚀 AuthService onApplicationBootstrap');
    const data = await this.getAccessToken({
      sub: '1111111',
      username: 'test',
    });
    console.log('🚀 AuthService onApplicationBootstrap data:', data);
    const data2 = await this.verifyAccessToken(data);
    console.log('🚀 AuthService onApplicationBootstrap data2:', data2);
  }
}
