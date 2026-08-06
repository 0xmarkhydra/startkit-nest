# Startkit Nest

A production-minded NestJS starter kit for applications that need an HTTP API, background workers, PostgreSQL, Redis, Bull queues, structured logging, Swagger, validation, rate limiting, and automated tests.

## What this starter provides

- Separate API and worker entrypoints
- Centralized and validated environment configuration
- PostgreSQL through TypeORM
- Redis-backed cache and Bull queues
- A neutral sample queue producer and worker consumer
- Structured Pino logging with sensitive-header redaction
- Global request validation and standardized API responses
- Global rate limiting
- Swagger documentation in non-production environments
- Liveness and readiness endpoints
- Docker and Docker Compose setup
- Unit, end-to-end, build, and Docker checks in GitHub Actions

The core intentionally does not ship product-specific authentication, AI integrations, WebSocket events, entities, repositories, or scheduled jobs. Add those as explicit application modules when they are needed.

## Architecture

```text
src/
├── main.ts                 # HTTP API entrypoint
├── worker.ts               # Background worker entrypoint
├── app.module.ts           # API application root
├── worker-app.module.ts    # Worker application root
├── core/                   # Global configuration and logging
├── modules/
│   ├── api/                # Controllers, filters and interceptors
│   ├── database/           # TypeORM connection infrastructure
│   ├── queue/              # Bull configuration and producers
│   └── worker/             # Queue consumers
└── shared/                 # Shared contracts, decorators and constants
```

The API and worker are independent processes. They share configuration and infrastructure, while the worker does not initialize HTTP controllers, Swagger, CORS, HTTP cache, or rate limiting.

## Requirements

- Node.js 20 or newer
- pnpm 9
- PostgreSQL 16+
- Redis 7+

Docker Desktop is enough for local infrastructure.

## Quick start

```bash
cp .env.sample .env
pnpm install

docker compose up -d postgres redis
pnpm run start:dev
```

The API is available at:

```text
http://localhost:8000
```

Swagger is available outside production at:

```text
http://localhost:8000/docs
```

Health endpoints:

```text
GET /health
GET /health/ready
```

## Run the worker

```bash
pnpm run start:worker:dev
```

API and worker can also be launched together with Docker Compose:

```bash
docker compose up --build
```

## Sample queue

`QueueService.addSampleJob()` demonstrates how the API side can enqueue work. `SampleConsumer` demonstrates how the worker processes the job with structured logging.

Replace the sample queue name, payload, producer, and consumer with a real application feature rather than adding product-specific behavior to the shared core.

## Scripts

| Command | Purpose |
|---|---|
| `pnpm run start:dev` | Run the API in watch mode |
| `pnpm run start:worker:dev` | Run the worker in watch mode |
| `pnpm run build` | Compile all TypeScript entrypoints |
| `pnpm run start:prod` | Run the compiled API |
| `pnpm run start:worker:prod` | Run the compiled worker |
| `pnpm run test` | Run unit tests |
| `pnpm run test:e2e` | Run end-to-end tests |
| `pnpm run test:cov` | Generate test coverage |
| `pnpm run lint` | Check lint rules |
| `pnpm run lint:fix` | Format and fix lint issues |
| `pnpm run check` | Run lint, build, and unit tests |

## Environment

The application fails fast when required infrastructure variables are missing.

```env
APP_ENV=development
PORT=8000
CORS_ORIGIN=http://localhost:3000
DATABASE_URL=postgresql://startkit:startkit@localhost:5432/startkit
REDIS_URL=redis://localhost:6379/0
DB_SYNC=0
DB_DEBUG=0
```

For production:

- Keep `DB_SYNC=0` and manage schema changes through migrations.
- Restrict `CORS_ORIGIN` to trusted frontends.
- Run API and worker as separate deployments.
- Store secrets in the deployment platform, not in committed files.

## API responses

Successful controller responses are wrapped globally:

```json
{
  "data": {},
  "msg": "Operation completed",
  "status_code": 200,
  "timestamp": "2026-08-06T00:00:00.000Z"
}
```

Unexpected production errors return a safe generic response with an error ID. Internal causes are only exposed outside production.

## Database schema

The starter does not create placeholder tables. Add entities and TypeORM migrations as part of the first real feature. The readiness endpoint checks PostgreSQL with `SELECT 1` and does not depend on an application table.

## Deployment

Build one image and run it with different commands:

```bash
node dist/main.js
node dist/worker.js
```

The included Docker image defaults to the API command. Override the command with `node dist/worker.js` for worker deployments.

## Current roadmap

1. TypeORM migration commands and an initial real feature migration
2. A complete example HTTP endpoint that enqueues the sample job
3. Authentication as an optional application module
4. Stronger integration-test coverage
5. Optional WebSocket and scheduler modules with dedicated tests

## License

MIT
