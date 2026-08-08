# Startkit Nest

A production-minded NestJS starter kit designed to scale horizontally with a Fastify HTTP API, independent Bull workers, PostgreSQL, Redis, structured logging, health checks, validation, and automated tests.

## What this starter provides

- Fastify-based NestJS API
- Separate stateless API and worker entrypoints
- PostgreSQL through TypeORM with bounded per-process connection pools
- Redis-backed cache and Bull queues
- Redis-backed distributed rate limiting shared by all API replicas
- Configurable worker concurrency
- Liveness and PostgreSQL + Redis readiness endpoints
- Replica-aware structured logging and health responses
- Request body, connection, request, and keep-alive timeouts
- Reverse-proxy-aware client IP handling
- Nginx load-balancer example for local multi-replica Docker Compose
- Graceful container signal handling through `tini`
- Swagger in non-production environments
- Unit, end-to-end, build, frozen-install, and Docker checks in GitHub Actions

The core intentionally does not ship product-specific authentication, AI integrations, WebSocket events, entities, repositories, or scheduled jobs. Add those as explicit application modules when needed.

## Architecture

```text
                         Load balancer / ingress
                                  │
                 ┌────────────────┼────────────────┐
                 │                │                │
              API #1           API #2           API #N
             Fastify           Fastify           Fastify
                 │                │                │
                 └────────────┬───┴───────┬────────┘
                              │           │
                         PostgreSQL     Redis
                              │           │
                              │       Bull queues
                              │           │
                         ┌────┴───────────┴────┐
                         │                     │
                     Worker #1             Worker #M
```

API replicas do not keep request coordination state in process memory. Rate-limit counters live in Redis, queues live in Redis, and persistent data lives in PostgreSQL. This lets the API and worker tiers scale independently.

## Source layout

```text
src/
├── main.ts                 # Fastify API entrypoint
├── worker.ts               # Background worker entrypoint
├── app.module.ts           # API application root
├── worker-app.module.ts    # Worker application root
├── core/                   # Global configuration and logging
├── modules/
│   ├── api/                # Controllers, filters, guards and interceptors
│   ├── database/           # TypeORM connection infrastructure
│   ├── queue/              # Bull configuration and producers
│   ├── redis/              # Shared Redis infrastructure
│   └── worker/             # Queue consumers
└── shared/                 # Shared contracts, decorators and constants
```

## Requirements

- Node.js 20+
- pnpm 9
- PostgreSQL 16+
- Redis 7+

## Local development

```bash
cp .env.sample .env
pnpm install

docker compose up -d postgres redis
pnpm run start:dev
```

Run the worker separately:

```bash
pnpm run start:worker:dev
```

API endpoints:

```text
GET http://localhost:8000/health
GET http://localhost:8000/health/ready
GET http://localhost:8000/docs   # non-production only
```

`/health` is a process liveness endpoint. `/health/ready` verifies both PostgreSQL and Redis and is intended for load balancers and orchestrator readiness probes.

## Horizontal scaling with Docker Compose

The Compose topology exposes only the Nginx gateway on host port `8000`. API containers use only the internal Docker network, so multiple replicas do not conflict over a host port.

Start three APIs and four workers:

```bash
docker compose up --build --scale api=3 --scale worker=4
```

Test load balancing:

```bash
curl http://localhost:8000/health
```

The response contains `instanceId`, normally derived from the container hostname, so repeated requests can show which API replica handled the request.

The bundled Nginx configuration uses Docker DNS and dynamically resolves the `api` service. In production, replace this example gateway with your cloud load balancer, Kubernetes ingress, ECS/ALB, Nomad proxy, or equivalent.

## PostgreSQL pool sizing

`DB_POOL_MAX` is the maximum PostgreSQL pool size **per process**. Every API replica and worker process that imports the database module can open up to that many connections.

Use this as the upper-bound planning formula:

```text
maximum application connections
≈ (API replicas + worker replicas) × DB_POOL_MAX
```

Example:

```text
5 API replicas
3 worker replicas
DB_POOL_MAX=10

upper bound ≈ 80 PostgreSQL connections
```

Leave headroom for migrations, administrative sessions, monitoring, and other services. For large deployments, use a managed pooler or PgBouncer rather than continually increasing PostgreSQL connection counts.

## Distributed rate limiting

Rate limiting is stored in Redis rather than process memory. All API replicas therefore consume from the same rolling window for a given route and client IP.

Configuration:

```env
RATE_LIMIT_MAX=600
RATE_LIMIT_TTL_SECONDS=60
RATE_LIMIT_FAIL_OPEN=0
```

With `RATE_LIMIT_FAIL_OPEN=0`, loss of the shared rate-limit store returns `503` instead of silently giving every replica an independent allowance. Set fail-open only when availability is more important than rate-limit enforcement for your application.

Health endpoints are excluded from rate limiting so infrastructure probes do not consume request quota.

## Reverse proxy configuration

Fastify uses `request.ip` for distributed rate limiting. When the API is behind a trusted proxy, configure `TRUST_PROXY` so Fastify can use forwarded client IP information correctly.

The bundled Compose setup sets:

```env
TRUST_PROXY=1
```

because API containers are not directly exposed to the public internet and only receive traffic through the internal gateway.

For a public production deployment, prefer an explicit trusted proxy address or network instead of blindly trusting arbitrary forwarded headers.

## HTTP limits and timeouts

```env
HTTP_BODY_LIMIT_BYTES=1048576
HTTP_REQUEST_TIMEOUT_MS=30000
HTTP_CONNECTION_TIMEOUT_MS=10000
HTTP_KEEP_ALIVE_TIMEOUT_MS=65000
```

Keep load-balancer and application timeouts aligned. Long-running work should normally be moved to Bull rather than holding HTTP connections open.

## Worker scaling

Each worker process can process multiple jobs concurrently:

```env
WORKER_CONCURRENCY=10
```

Scale worker replicas independently from API replicas:

```bash
docker compose up --scale api=3 --scale worker=8
```

Choose concurrency based on the actual job type. I/O-bound jobs can generally use higher concurrency than CPU-heavy jobs.

## Environment

See `.env.sample` for all options. The main scaling-related settings are:

```env
APP_ENV=development
PORT=8000
CORS_ORIGIN=http://localhost:3000
INSTANCE_ID=
TRUST_PROXY=0

DATABASE_URL=postgresql://startkit:startkit@localhost:5432/startkit
DB_POOL_MAX=10
DB_CONNECTION_TIMEOUT_MS=5000
DB_IDLE_TIMEOUT_MS=30000
DB_STATEMENT_TIMEOUT_MS=30000

REDIS_URL=redis://localhost:6379/0
RATE_LIMIT_MAX=600
RATE_LIMIT_TTL_SECONDS=60
RATE_LIMIT_FAIL_OPEN=0
WORKER_CONCURRENCY=10
```

For production:

- Keep `DB_SYNC=0` and use migrations.
- Restrict `CORS_ORIGIN` to trusted frontends.
- Keep API instances stateless.
- Store sessions, locks, quotas, and shared cache state outside process memory.
- Run API and worker tiers as separate deployments and autoscale them independently.
- Set `TRUST_PROXY` only for trusted proxies or internal ingress networks.
- Size aggregate PostgreSQL pools before raising replica counts.
- Use managed/HA PostgreSQL and Redis when application availability requires it.
- Store secrets in the deployment platform rather than committed files.

## Sample queue

`QueueService.addSampleJob()` demonstrates how application code can enqueue work. `SampleConsumer` demonstrates a worker processor with configurable concurrency and structured logging.

Replace the sample queue name, payload, producer, and consumer with real application features rather than putting product-specific behavior into shared infrastructure.

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

## API responses

Successful controller responses are wrapped globally:

```json
{
  "data": {},
  "msg": "Operation completed",
  "status_code": 200,
  "timestamp": "2026-08-08T00:00:00.000Z"
}
```

Unexpected production errors return a generic message and an `errorId`. The exception filter is HTTP-adapter agnostic and does not depend on Express response types.

## Database schema

The starter does not create placeholder tables. Add entities and TypeORM migrations as part of the first real feature. Readiness uses `SELECT 1` and does not depend on an application table.

## Deployment image

The same image is used for both process types:

```bash
node dist/main.js
node dist/worker.js
```

`tini` is the container entrypoint so termination signals reach Node cleanly during rolling deployments and scale-down operations.

## What horizontal scalability does not solve

Adding replicas does not automatically fix inefficient SQL, N+1 queries, missing indexes, oversized responses, CPU-heavy synchronous code, or slow external providers. Benchmark real endpoints and watch p95/p99 latency, error rate, CPU, memory, PostgreSQL saturation, Redis latency, and queue depth before deciding the next scaling step.

## Roadmap

1. TypeORM migration commands and a real example feature migration
2. Complete HTTP → queue → worker example endpoint
3. Authentication as an optional application module
4. Metrics endpoint and OpenTelemetry/Prometheus integration
5. k6 load-test scenarios and documented capacity baselines
6. Optional WebSocket and scheduler modules with dedicated scaling guidance

## License

MIT
