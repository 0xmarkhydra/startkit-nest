import { Controller, Post, Body, HttpStatus, UseGuards, Get, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../../database/entities/user.entity';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { UserDecorator } from '../decorator/user.decorator';

interface LoginDto {
  email: string;
  password: string;
}

interface RegisterDto {
  name: string;
  email: string;
  password: string;
  referralCode: string;
}

interface WalletLoginDto {
  walletAddress: string;
}

@ApiTags('Auth')
@Controller('api/auth')
export class AuthController {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Login successful' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto) {
    try {
      const { email, password } = loginDto;
      
      // Find user by email
      const user = await this.userRepository.findOne({ where: { email } });
      
      if (!user) {
        return {
          success: false,
          message: 'Invalid email or password',
        };
      }
      
      // Check if password is correct
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      
      if (!isPasswordValid) {
        return {
          success: false,
          message: 'Invalid email or password',
        };
      }
      
      // Generate JWT token
      const token = this.jwtService.sign({
        id: user.id,
        email: user.email,
      });
      
      return {
        success: true,
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          walletAddress: user.walletAddress,
        },
        token,
      };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        message: 'An error occurred during login',
      };
    }
  }

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'User registered successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input or email already exists' })
  async register(@Body() registerDto: RegisterDto) {
    try {
      const { name, email, password, referralCode } = registerDto;
      
      // Check if referral code is valid
      if (referralCode !== 'LYNX2023') {
        return {
          success: false,
          message: 'Invalid referral code',
        };
      }
      
      // Check if user already exists
      const existingUser = await this.userRepository.findOne({ where: { email } });
      
      if (existingUser) {
        return {
          success: false,
          message: 'Email already exists',
        };
      }
      
      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);
      
      // Create new user
      const user = this.userRepository.create({
        name,
        email,
        passwordHash,
      });
      
      await this.userRepository.save(user);
      
      // Generate JWT token
      const token = this.jwtService.sign({
        id: user.id,
        email: user.email,
      });
      
      return {
        success: true,
        message: 'Registration successful',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        token,
      };
    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        message: 'An error occurred during registration',
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiOperation({ summary: 'Get current user information' })
  @ApiResponse({ status: HttpStatus.OK, description: 'User information retrieved successfully' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  async getCurrentUser(@UserDecorator() user: any) {
    try {
      const userInfo = await this.userRepository.findOne({ where: { id: user.id } });
      
      if (!userInfo) {
        return {
          success: false,
          message: 'User not found',
        };
      }
      
      return {
        success: true,
        user: {
          id: userInfo.id,
          email: userInfo.email,
          name: userInfo.name,
          walletAddress: userInfo.walletAddress,
        },
      };
    } catch (error) {
      console.error('Get current user error:', error);
      return {
        success: false,
        message: 'An error occurred while retrieving user information',
      };
    }
  }
} 