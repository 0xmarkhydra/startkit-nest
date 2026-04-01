import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger, ValidationPipe } from '@nestjs/common';
import { GlobalExceptionFilter } from '@/api/filters/GlobalExceptionFilter';
import { Logger as PinoLogger } from 'nestjs-pino';
import { join } from 'path';
import * as express from 'express';

const isApi = Boolean(Number(process.env.IS_API || 0));

const PORT = process.env.PORT || '3000';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // logger: false,
    // bufferLogs: true,
  });

  if (isApi) {
    // Tăng giới hạn body size để hỗ trợ Cursor IDE và các client gửi payload lớn
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ limit: '50mb', extended: true }));

    // const corsOrigin = process.env.CORS_ORIGIN.split(',') || [
    //   'http://localhost:3000',
    // ];

    app.enableCors({
      // allowedHeaders: ['content-type'],
      origin: '*',
      // credentials: true,
    });

    app.useLogger(app.get(PinoLogger));
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    app.useGlobalFilters(new GlobalExceptionFilter(true, true));

    // Serve static files from public directory
    app.use('/public', express.static(join(__dirname, '..', 'public')));
    
    // Redirect root to test features page using Express
    const server = app.getHttpAdapter().getInstance();
    server.get('/', (req: any, res: any) => {
      res.redirect('/public/test-features.html');
    });

    if (process.env.APP_ENV !== 'production') {
      const options = new DocumentBuilder()
        .setTitle('API docs')
        // .setVersion(DEFAULT_API_VERSION)
        .addBearerAuth(
          {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'API Key',
            description: 'Enter your API Key as: Bearer <your-api-key>',
          },
          'LynxAI-Key',
        )
        .build();
      const document = SwaggerModule.createDocument(app, options);
      SwaggerModule.setup('docs', app, document);
    }
    await app.listen(PORT);
    Logger.log(`🚀 Application is running in port http://localhost:${PORT}`);
    Logger.log(`📁 Static files available at http://localhost:${PORT}/public/`);
    Logger.log(`🎮 Test dashboard at http://localhost:${PORT}/`);
  } else {
    await app.init();
  }
}
bootstrap();
