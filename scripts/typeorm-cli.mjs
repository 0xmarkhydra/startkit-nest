import { existsSync } from 'fs';
import { createRequire } from 'module';
import { spawnSync } from 'child_process';

const [command, ...commandArgs] = process.argv.slice(2);
if (!command) {
  throw new Error('A TypeORM command is required');
}

const require = createRequire(import.meta.url);
const typeormCli = require.resolve('typeorm/cli.js');
const nodeArgs = [];

if (existsSync('.env')) {
  nodeArgs.push('--env-file=.env');
}

nodeArgs.push(typeormCli, command, ...commandArgs);
if (command !== 'migration:create') {
  nodeArgs.push('-d', 'dist/modules/database/data-source.js');
}

const result = spawnSync(process.execPath, nodeArgs, {
  cwd: process.cwd(),
  env: process.env,
  stdio: 'inherit',
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
