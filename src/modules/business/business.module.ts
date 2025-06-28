import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { 
  OpenaiService, 
  WalletService, 
  InvestmentService,
  SolanaService
} from './services';

@Module({
  imports: [
    DatabaseModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('auth.jwt.jwt_secret_key') || 'default_secret_key',
      }),
      inject: [ConfigService],
    })
  ],
  providers: [
    OpenaiService, 
    WalletService, 
    InvestmentService,
    SolanaService
  ],
  exports: [
    OpenaiService, 
    WalletService, 
    InvestmentService,
    SolanaService
  ],
})
export class BusinessModule {}
