import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from '@/api/filters/GlobalExceptionFilter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);
  const appEnv = configService.get<string>('APP_ENV') || 'development';
  const isProduction = appEnv === 'production';
  const port = configService.get<number>('PORT') || 8000;
  const corsOrigins = (configService.get<string>('CORS_ORIGIN') || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.useLogger(app.get(PinoLogger));
  app.enableShutdownHooks();
  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : false,
    credentials: true,
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
    new GlobalExceptionFilter(!isProduction, true),
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

bootstrap().catch((error) => {
  Logger.error('Failed to start API', error?.stack || error);
  process.exit(1);
});
