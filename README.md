# Startkit Nest

A production-minded NestJS starter kit for applications that need an HTTP API, background workers, PostgreSQL, Redis, Bull queues, structured logging, Swagger, validation, rate limiting, and automated tests.

## What this starter provides

- Separate API and worker entrypoints
- Centralized and validated environment configuration
- PostgreSQL through TypeORM
- Redis-backed cache and Bull queues
- Structured Pino logging with sensitive-header redaction
- Global request validation and standardized API responses
- Global rate limiting
- Swagger documentation in non-production environments
- Liveness and readiness endpoints
- Docker and Docker Compose setup
- Unit, end-to-end, build, and Docker checks in GitHub Actions

> Authentication infrastructure is prepared through `JwtModule`, but a complete user registration, login, refresh-token, and authorization flow is intentionally not claimed as finished yet.

## Architecture

```text
src/
├── main.ts                 # HTTP API entrypoint
├── worker.ts               # Background worker entrypoint
├── app.module.ts           # API application root
├── worker-app.module.ts    # Worker application root
├── core/                   # Global configuration and logging
├── modules/
│   ├── api/                # Controllers, filters, guards, interceptors
│   ├── business/           # Business services
│   ├── database/           # TypeORM entities and repositories
│   ├── queue/              # Bull queues and producers
│   ├── websocket/          # Optional Socket.IO gateway
│   └── worker/             # Queue consumers and scheduled jobs
└── shared/                 # Shared contracts, decorators and utilities
```

The API and worker are independent processes. They share the same core modules and infrastructure, but the worker does not initialize HTTP controllers, Swagger, CORS, HTTP cache, or rate limiting.

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

## Environment

The application fails fast when required infrastructure variables are missing.

```env
APP_ENV=development
PORT=8000
CORS_ORIGIN=http://localhost:3000
JWT_SECRET_KEY=change-me-with-a-long-random-secret
DATABASE_URL=postgresql://startkit:startkit@localhost:5432/startkit
REDIS_URL=redis://localhost:6379/0
DB_SYNC=0
DB_DEBUG=0
```

For production:

- Use a long random `JWT_SECRET_KEY`.
- Do not use a value containing `change-me`.
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

## Deployment

Build one image and run it with different commands:

```bash
node dist/main.js
node dist/worker.js
```

The included Docker image defaults to the API command. Override the command with `node dist/worker.js` for worker deployments.

## Current roadmap

The next production layers are:

1. Complete authentication and user modules
2. Refresh-token rotation and role/permission guards
3. TypeORM migration commands and an initial migration
4. A complete example feature from controller to queue consumer
5. WebSocket authentication and explicit module opt-in
6. Stronger integration-test coverage

## License

MIT
