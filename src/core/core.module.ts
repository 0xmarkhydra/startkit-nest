import { Global, Module, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { configAuth } from '@/api/configs/auth';
import { configCache } from '@/api/configs/cache';
import { configDb } from '@/database/configs';
import { configQueue } from '@/queue/configs';
import { validateEnvironment } from './env.validation';

const isProduction = process.env.APP_ENV === 'production';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      validate: validateEnvironment,
      load: [configAuth, configCache, configDb, configQueue],
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
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
    }),
  ],
  exports: [ConfigModule, LoggerModule],
})
export class CoreModule {}
