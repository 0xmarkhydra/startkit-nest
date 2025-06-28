import { Controller, Post, Body, Get, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { WalletService } from '../../business/services/wallet.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { UserDecorator } from '../decorator/user.decorator';
import { User } from '../../database/entities/user.entity';

@ApiTags('Wallet')
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Post('connect')
  @ApiOperation({ 
    summary: 'Connect Phantom wallet',
    description: 'Authenticate user with Phantom wallet signature' 
  })
  @ApiResponse({
    status: 200,
    description: 'Wallet connected successfully'
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid wallet signature'
  })
  async connectWallet(@Body() body: { walletAddress: string; signature: string; message: string; }) {
    console.log('🔗 [WalletController] [connectWallet] body:', body);
    
    const result = await this.walletService.verifyAndAuthenticate(
      body.walletAddress,
      body.signature,
      body.message
    );
    
    console.log('✅ [WalletController] [connectWallet] result:', result);
    
    return {
      statusCode: 200,
      message: 'Wallet connected successfully',
      data: result,
      timestamp: new Date().toISOString()
    };
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Get user profile',
    description: 'Get current user profile information' 
  })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully'
  })
  async getUserProfile(@UserDecorator() user: User) {
    console.log('👤 [WalletController] [getUserProfile] user:', user.walletAddress);
    
    const profile = await this.walletService.getUserProfile(user.id);
    
    return {
      statusCode: 200,
      message: 'User profile retrieved successfully',
      data: profile,
      timestamp: new Date().toISOString()
    };
  }
} 