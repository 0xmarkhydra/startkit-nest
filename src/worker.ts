import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Logger as PinoLogger } from 'nestjs-pino';
import { WorkerAppModule } from './worker-app.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerAppModule, {
    bufferLogs: true,
  });

  app.useLogger(app.get(PinoLogger));
  app.enableShutdownHooks();
  Logger.log('Worker is running');
}

bootstrap().catch((error) => {
  Logger.error('Failed to start worker', error?.stack || error);
  process.exit(1);
});
