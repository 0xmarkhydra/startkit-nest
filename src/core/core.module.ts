import { Global, Module, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { validateEnvironment } from './env.validation';
import { safeRequestPath } from './request-safety';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      validate: validateEnvironment,
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
        const redactPaths = [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.headers["x-api-key"]',
          'req.headers["proxy-authorization"]',
          'res.headers["set-cookie"]',
          ...(isProduction ? ['req.url'] : []),
        ];

        return {
          pinoHttp: {
            level:
              configService.get<string>('LOG_LEVEL') ||
              (isProduction ? 'info' : 'debug'),
            redact: {
              paths: redactPaths,
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
            customSuccessMessage: (req) =>
              `${req.method} ${safeRequestPath(req.url)}`,
            customErrorMessage: (req, _res, error) =>
              `${req.method} ${safeRequestPath(req.url)} failed: ${error.message}`,
          },
          exclude: [
            { method: RequestMethod.ALL, path: 'health' },
            { method: RequestMethod.ALL, path: 'health/live' },
            { method: RequestMethod.ALL, path: 'health/ready' },
            { method: RequestMethod.ALL, path: 'health/dependencies' },
            { method: RequestMethod.ALL, path: 'metrics' },
          ],
        };
      },
    }),
  ],
  exports: [ConfigModule, LoggerModule],
})
export class CoreModule {}
