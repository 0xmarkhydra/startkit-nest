import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UserRepository } from '@/database/repositories/user.repository';
import {
  CreateUserDto,
  LoginDto,
  TokenResponseDto,
  UserResponseDto,
} from '../dtos/user';

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(createUserDto: CreateUserDto): Promise<TokenResponseDto> {
    // Check if email already exists
    const existingUser = await this.userRepository.findByEmail(createUserDto.email);
    if (existingUser) {
      throw new ConflictException({
        statusCode: HttpStatus.CONFLICT,
        message: 'Email already exists',
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    // Create user
    const user = this.userRepository.create({
      email: createUserDto.email,
      hashedPassword,
      displayName: createUserDto.displayName || null,
      role: 'user',
      isActive: true,
    });

    const savedUser = await this.userRepository.save(user);

    // Generate tokens
    const tokens = await this.generateTokens(savedUser.id, savedUser.email);

    return {
      ...tokens,
      user: this.mapToUserResponse(savedUser),
    };
  }

  async login(loginDto: LoginDto): Promise<TokenResponseDto> {
    // Find user by email
    const user = await this.userRepository.findByEmail(loginDto.email);
    if (!user) {
      throw new UnauthorizedException({
        statusCode: HttpStatus.UNAUTHORIZED,
        message: 'Invalid credentials',
      });
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedException({
        statusCode: HttpStatus.UNAUTHORIZED,
        message: 'Account is deactivated',
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.hashedPassword,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException({
        statusCode: HttpStatus.UNAUTHORIZED,
        message: 'Invalid credentials',
      });
    }

    // Update last login
    await this.userRepository.updateLastLogin(user.id);

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email);

    return {
      ...tokens,
      user: this.mapToUserResponse(user),
    };
  }

  async getCurrentUser(userId: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedException({
        statusCode: HttpStatus.UNAUTHORIZED,
        message: 'User not found',
      });
    }
    return this.mapToUserResponse(user);
  }

  private async generateTokens(
    userId: string,
    email: string,
  ): Promise<Omit<TokenResponseDto, 'user'>> {
    const payload = { sub: userId, email };
    const accessTokenLifetime = this.configService.get<number>(
      'auth.jwt.access_token_lifetime',
      60 * 60 * 24 * 7,
    ); // 7 days default

    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: accessTokenLifetime,
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      expiresIn: accessTokenLifetime * 2, // Refresh token lasts twice as long
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: accessTokenLifetime,
      tokenType: 'Bearer',
    };
  }

  private mapToUserResponse(user: any): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName || undefined,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  }
}