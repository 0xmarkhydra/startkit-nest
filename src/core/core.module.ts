import { Global, Module, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { configCache } from '@/api/configs/cache';
import { configDb } from '@/database/configs';
import { configQueue } from '@/queue/configs';
import { validateEnvironment } from './env.validation';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      validate: validateEnvironment,
      load: [configCache, configDb, configQueue],
    }),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isProduction = configService.get('APP_ENV') === 'production';

        return {
          pinoHttp: {
            level:
              configService.get<string>('LOG_LEVEL') ||
              (isProduction ? 'info' : 'debug'),
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'res.headers["set-cookie"]',
              ],
              censor: '[REDACTED]',
            },
            ...(isProduction
              ? {}
              : {
                  transport: {
                    target: 'pino-pretty',
                    options: {
                      colorize: true,
                      singleLine: true,
                      ignore: 'pid,hostname',
                      translateTime: 'SYS:standard',
                    },
                  },
                }),
            customProps: () => ({ context: 'HTTP' }),
            customSuccessMessage: (req) => `${req.method} ${req.url}`,
            customErrorMessage: (req, _res, error) =>
              `${req.method} ${req.url} failed: ${error.message}`,
          },
          exclude: [{ method: RequestMethod.ALL, path: 'health' }],
        };
      },
    }),
  ],
  exports: [ConfigModule, LoggerModule],
})
export class CoreModule {}
