import { CommandFactory } from 'nest-commander';
import { BusinessModule } from './modules/business/business.module';

async function bootstrap() {
  await CommandFactory.run(BusinessModule, {
    logger: ['error', 'warn', 'log'],
  });
}

bootstrap().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
