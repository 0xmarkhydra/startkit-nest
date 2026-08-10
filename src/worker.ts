import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Logger as PinoLogger } from 'nestjs-pino';

process.env.STARTKIT_PROCESS_ROLE = 'worker';

async function bootstrap(): Promise<void> {
  const { WorkerAppModule } = await import('./worker-app.module');
  const app = await NestFactory.createApplicationContext(WorkerAppModule, {
    bufferLogs: true,
  });

  app.useLogger(app.get(PinoLogger));
  app.enableShutdownHooks();
  Logger.log('Worker is running');
}

bootstrap().catch((error: unknown) => {
  const details =
    error instanceof Error ? error.stack || error.message : String(error);
  Logger.error('Failed to start worker', details);
  process.exit(1);
});
