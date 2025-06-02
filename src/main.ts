import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger, ValidationPipe } from '@nestjs/common';
import { GlobalExceptionFilter } from '@/api/filters/GlobalExceptionFilter';
import { Logger as PinoLogger } from 'nestjs-pino';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

const isApi = Boolean(Number(process.env.IS_API || 0));

const PORT = process.env.PORT || '3000';
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // logger: false,
    // bufferLogs: true,
  });
  
  // Serve static files from the public directory
  app.useStaticAssets(join(process.cwd(), 'public'));

  if (isApi) {
    app.enableCors({
      allowedHeaders: ['content-type', 'authorization'],
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      credentials: true,
    });

    app.useLogger(app.get(PinoLogger));
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    app.useGlobalFilters(new GlobalExceptionFilter(true, true));

    if (process.env.APP_ENV !== 'production') {
      const options = new DocumentBuilder()
        .setTitle('API docs')
        // .setVersion(DEFAULT_API_VERSION)
        .addBearerAuth()
        .build();
      const document = SwaggerModule.createDocument(app, options);
      SwaggerModule.setup('docs', app, document);
    }
    await app.listen(PORT);
    Logger.log(`🚀 Application is running in port ${PORT}`);
  } else {
    await app.init();
  }
}
bootstrap();
