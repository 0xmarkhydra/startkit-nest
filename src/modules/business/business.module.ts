import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/database';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './services/auth.service';
import { JwtModule } from '@nestjs/jwt';
import { UserService } from './services/user.service';
import { TelegramService } from './services/telegram.service';

const services = [AuthService, UserService];

@Module({
  imports: [DatabaseModule, JwtModule],
  providers: [...services],
  exports: [...services],
})
export class BusinessModule {}
