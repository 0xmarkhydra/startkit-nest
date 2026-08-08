import { Global, Module, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { configDb } from '@/database/configs';
import { configRedis } from '@/redis/configs/redis';
import { validateEnvironment } from './env.validation';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      validate: validateEnvironment,
      load: [configDb, configRedis],
    }),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isProduction = configService.get('APP_ENV') === 'production';
        const instanceId =
          configService.get<string>('INSTANCE_ID') ||
          process.env.HOSTNAME ||
          'local';

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
            customProps: () => ({ context: 'HTTP', instanceId }),
            customSuccessMessage: (req) => `${req.method} ${req.url}`,
            customErrorMessage: (req, _res, error) =>
              `${req.method} ${req.url} failed: ${error.message}`,
          },
          exclude: [
            { method: RequestMethod.ALL, path: 'health' },
            { method: RequestMethod.ALL, path: 'health/ready' },
          ],
        };
      },
    }),
  ],
  exports: [ConfigModule, LoggerModule],
})
export class CoreModule {}
