import { AuthService } from '@/business/services/auth.service';
import { UserRepository } from '@/database/repositories';
import { ResponseMessage } from '@/shared/decorators/response-message.decorator';
import { ApiBaseResponse } from '@/shared/swagger/decorator/api-response.decorator';
import {
  Controller,
  ForbiddenException,
  Get,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { UserService } from '@/business/services/user.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly userService: UserService) {}

  @Get('check-token')
  @ResponseMessage('Token verified successfully')
  async checkToken(@Query('token') token: string) {
    if (!token) {
      throw new ForbiddenException('Token is required');
    }
    
    try {
      const decodedToken = await this.userService.verifyToken(token);
      console.log('🔑 AuthController checkToken decodedToken:', decodedToken);
      return decodedToken;
    } catch (error) {
      console.error('❌ AuthController checkToken error:', error);
      throw new ForbiddenException('Invalid token');
    }
  }
}
