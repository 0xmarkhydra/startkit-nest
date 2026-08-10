import { join } from 'path';
import { DataSource, DataSourceOptions } from 'typeorm';
import { createDatabaseOptions } from './configs';

const databaseOptions = createDatabaseOptions();
delete databaseOptions.autoLoadEntities;

export default new DataSource({
  ...databaseOptions,
  synchronize: false,
  migrationsRun: false,
  entities: [join(__dirname, '../**/*.entity{.js,.ts}')],
  migrations: [join(__dirname, 'migrations/*{.js,.ts}')],
} as DataSourceOptions);
