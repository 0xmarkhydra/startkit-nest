import { Module } from '@nestjs/common';
import { configDb } from './configs';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminConfigRepository, UserRepository, ApiKeyRepository, RequestLogRepository } from './repositories';
import { AdminConfigEntity } from './entities/admin-config.entity';
import { UserEntity } from './entities/user.entity';
import { ApiKeyEntity } from './entities/api-key.entity';
import { RequestLogEntity } from './entities/request-log.entity';
import { SeedDatabase } from './seeders/seed.database';

const repositories = [AdminConfigRepository, UserRepository, ApiKeyRepository, RequestLogRepository];

const services = [];

const entities = [AdminConfigEntity, UserEntity, ApiKeyEntity, RequestLogEntity];

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: (config: ConfigService) => config.get('db'),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature(entities),
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      load: [configDb],
    }),
  ],
  controllers: [],
  providers: [...repositories, ...services, SeedDatabase],
  exports: [...repositories, ...services],
})
export class DatabaseModule {}
