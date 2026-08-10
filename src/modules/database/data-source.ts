import { join } from 'path';
import { DataSource, DataSourceOptions } from 'typeorm';
import { createDatabaseOptions } from './configs';

const options = { ...createDatabaseOptions() } as Record<string, unknown>;
delete options.autoLoadEntities;

export default new DataSource({
  ...(options as DataSourceOptions),
  synchronize: false,
  entities: [join(__dirname, '../**/*.entity{.js,.ts}')],
  migrations: [join(__dirname, 'migrations/*{.js,.ts}')],
} as DataSourceOptions);
