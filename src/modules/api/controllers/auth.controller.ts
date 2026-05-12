import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Res,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { AuthService } from '../services/auth.service';
import { GetNonceQueryDto, VerifySignatureDto, AuthResponseDto } from '../dtos/auth.dto';

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
  constructor(private authService: AuthService) {}

  @Get('nonce')
  @ApiOperation({ summary: 'Get a nonce for wallet signature' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Nonce generated' })
  async getNonce(@Query() dto: GetNonceQueryDto) {
    const nonce = await this.authService.getNonce(dto.address);
    return { nonce, message: `Sign this message to authenticate: ${nonce}` };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify wallet signature and set httpOnly cookie' })
  @ApiResponse({ status: HttpStatus.OK, type: AuthResponseDto })
  async login(
    @Body() dto: VerifySignatureDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, user } = await this.authService.verifySignatureAndLogin(
      dto.address,
      dto.signature,
    );

    const expiresIn = Number(process.env.JWT_ACCESS_TOKEN_LIFETIME) || 60 * 60 * 24 * 7;

    res.cookie(COOKIE_NAME, accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: expiresIn * 1000,
    });

    return { user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Clear auth cookie' })
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(COOKIE_NAME, { ...COOKIE_OPTIONS });
    return { message: 'Logged out successfully' };
  }
}
