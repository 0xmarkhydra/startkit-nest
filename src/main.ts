import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from '@/api/filters/GlobalExceptionFilter';
import { parsePositiveIntegerEnv, parseTrustProxy } from './core/http-options';

async function bootstrap(): Promise<void> {
  const adapter = new FastifyAdapter({
    trustProxy: parseTrustProxy(),
    bodyLimit: parsePositiveIntegerEnv(
      process.env.HTTP_BODY_LIMIT_BYTES,
      1048576,
    ),
    requestTimeout: parsePositiveIntegerEnv(
      process.env.HTTP_REQUEST_TIMEOUT_MS,
      30000,
    ),
    connectionTimeout: parsePositiveIntegerEnv(
      process.env.HTTP_CONNECTION_TIMEOUT_MS,
      10000,
    ),
    keepAliveTimeout: parsePositiveIntegerEnv(
      process.env.HTTP_KEEP_ALIVE_TIMEOUT_MS,
      65000,
    ),
  });
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    adapter,
    { bufferLogs: true },
  );

  const configService = app.get(ConfigService);
  const appEnv = configService.get<string>('APP_ENV') || 'development';
  const isProduction = appEnv === 'production';
  const port = configService.get<number>('PORT') || 8000;
  const corsOrigins = (configService.get<string>('CORS_ORIGIN') || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const wildcardCors = corsOrigins.includes('*');

  app.useLogger(app.get(PinoLogger));
  app.enableShutdownHooks();
  app.enableCors({
    origin: wildcardCors ? '*' : corsOrigins.length > 0 ? corsOrigins : false,
    credentials: !wildcardCors && corsOrigins.length > 0,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: isProduction,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(
    new GlobalExceptionFilter(!isProduction, !isProduction),
  );

  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Startkit Nest API')
      .setDescription('Development API documentation')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  await app.listen(port, '0.0.0.0');
  Logger.log(`API is running at http://localhost:${port}`);
}

bootstrap().catch((error: unknown) => {
  const details =
    error instanceof Error ? error.stack || error.message : String(error);
  Logger.error('Failed to start API', details);
  process.exit(1);
});
