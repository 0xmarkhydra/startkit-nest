import {
  Controller,
  Post,
  Body,
  Res,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { AuthService } from '../services/auth.service';
import { RegisterDto, LoginDto, AuthResponseDto } from '../dtos/auth.dto';

const COOKIE_NAME = 'access_token';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.APP_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
};

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Register with email and password' })
  @ApiResponse({ status: HttpStatus.CREATED, type: AuthResponseDto })
  async register(@Body() dto: RegisterDto) {
    const user = await this.authService.register(dto.email, dto.password, dto.username);
    return { user };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: HttpStatus.OK, type: AuthResponseDto })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, user } = await this.authService.login(dto.email, dto.password);
    const expiresIn = this.configService.get<number>('auth.jwt.access_token_lifetime');

    res.cookie(COOKIE_NAME, accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: expiresIn * 1000,
    });

    return { user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Clear auth cookie' })
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(COOKIE_NAME, { ...COOKIE_OPTIONS });
    return { message: 'Logged out successfully' };
  }
}
