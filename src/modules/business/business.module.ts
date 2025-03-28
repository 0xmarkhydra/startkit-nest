import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/database';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './services/auth.service';
import { JwtModule } from '@nestjs/jwt';
import { UserService } from './services/user.service';
import { EvaluateService } from './services/evaluate.service';

const services = [AuthService, UserService, EvaluateService];

@Module({
  imports: [DatabaseModule, JwtModule],
  providers: [...services],
  exports: [...services],
})

export class BusinessModule {}
