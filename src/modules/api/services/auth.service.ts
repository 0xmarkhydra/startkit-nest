import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UserRepository } from '@/database/repositories';
import { TJWTPayload } from '@/shared/types';

@Injectable()
export class AuthService {
  constructor(
    private userRepository: UserRepository,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(email: string, password: string, username?: string) {
    const existing = await this.userRepository.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const password_hash = await bcrypt.hash(password, 10);
    const user = this.userRepository.create({ email, password_hash, username });
    await this.userRepository.save(user);

    return { id: user.id, email: user.email, username: user.username };
  }

  async login(email: string, password: string) {
    const user = await this.userRepository.findOne({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload: TJWTPayload = { sub: user.id };
    const secret = this.configService.get<string>('auth.jwt.jwt_secret_key');
    const expiresIn = this.configService.get<number>('auth.jwt.access_token_lifetime');

    const accessToken = await this.jwtService.signAsync(payload, { secret, expiresIn });

    return {
      accessToken,
      user: { id: user.id, email: user.email, username: user.username },
    };
  }
}
