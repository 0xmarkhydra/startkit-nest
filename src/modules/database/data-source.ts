import { join } from 'path';
import { DataSource, DataSourceOptions } from 'typeorm';
import { createDatabaseOptions } from './configs';

const databaseOptions = createDatabaseOptions();
delete databaseOptions.autoLoadEntities;
delete databaseOptions.retryAttempts;
delete databaseOptions.retryDelay;
delete databaseOptions.toRetry;
delete databaseOptions.verboseRetryLog;
delete databaseOptions.manualInitialization;

export default new DataSource({
  ...databaseOptions,
  synchronize: false,
  migrationsRun: false,
  entities: [join(__dirname, '../**/*.entity{.js,.ts}')],
  migrations: [join(__dirname, 'migrations/*{.js,.ts}')],
} as DataSourceOptions);
