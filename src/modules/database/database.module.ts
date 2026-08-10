import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { configDb } from './configs';

@Module({
  imports: [
    ConfigModule.forFeature(configDb),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        configService.getOrThrow('db'),
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
