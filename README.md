# Startkit Nest

A production-minded NestJS starter kit for horizontally scalable HTTP APIs and background workers. It uses Fastify, PostgreSQL, Redis, Bull, structured logging, strict configuration validation, health contracts, Prometheus-compatible process metrics, migrations, and multi-replica smoke tests.

## What this starter provides

- Fastify-based NestJS API
- Separate stateless API and worker entrypoints
- PostgreSQL through TypeORM with bounded per-process connection pools
- Redis-backed distributed rate limiting shared by all API replicas
- Bull queues with independently scalable workers
- One Redis configuration model for `redis://`, `rediss://`, and host/port deployments
- Configurable worker concurrency plus bounded retry/backoff defaults
- Liveness, readiness, dependency diagnostics, and Prometheus-compatible process metrics
- Strict production guardrails for environment names, database synchronization, and credentialed CORS
- Request body, connection, request, keep-alive, and dependency-probe timeouts
- Reverse-proxy-aware client IP handling with bounded trusted-hop support
- Nginx load-balancer example for local multi-replica Docker Compose
- Graceful container signal handling through `tini`
- Swagger in non-production environments
- TypeORM migration commands using a dedicated CLI data source
- Dependency-free HTTP load-smoke script with p50/p95/p99 output
- Unit, e2e, Docker, Nginx, failure-policy, worker-isolation, and multi-replica CI contracts

The core intentionally does not ship product-specific authentication, entities, AI integrations, WebSocket events, or scheduled jobs. Add product behavior as explicit application modules rather than putting it into the starter foundation.

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
                                          │
                                      Bull queues
                                          │
                                  ┌───────┴───────┐
                               Worker #1       Worker #M
```

API coordination state lives outside the process. Rate-limit counters live in Redis and persistent application data lives in PostgreSQL. Workers consume Bull queues from Redis and scale independently from API replicas.

Infrastructure dependencies are scoped to the process that uses them. The API imports `DatabaseModule` and Redis. The sample worker imports the queue layer and Redis but does not require PostgreSQL configuration or open a PostgreSQL pool.

## Source layout

```text
src/
├── main.ts                         # Fastify API entrypoint
├── worker.ts                       # Background worker entrypoint
├── app.module.ts                   # API application root
├── worker-app.module.ts            # Worker application root
├── core/                           # Global config, HTTP options and logging
├── modules/
│   ├── api/                        # Controllers, filters, guards, interceptors
│   ├── database/
│   │   ├── configs/                # Runtime DB configuration
│   │   ├── data-source.ts          # TypeORM CLI data source
│   │   └── migrations/             # Application migrations
│   ├── queue/                      # Bull infrastructure and producers
│   ├── redis/                      # Shared Redis configuration/client
│   └── worker/                     # Queue consumers
└── shared/                         # Shared contracts and decorators

test/
├── app.e2e-spec.ts                 # API + DB + Redis contracts
└── load-smoke.mjs                  # Dependency-free HTTP load smoke
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

Useful endpoints:

```text
GET http://localhost:8000/                     # rate-limited service info + instanceId
GET http://localhost:8000/health               # backwards-compatible liveness
GET http://localhost:8000/health/live          # explicit liveness
GET http://localhost:8000/health/ready         # traffic readiness policy
GET http://localhost:8000/health/dependencies  # dependency diagnostics
GET http://localhost:8000/metrics              # raw Prometheus-compatible process metrics
GET http://localhost:8000/docs                 # non-production only
```

## Horizontal scaling with Docker Compose

The Compose topology exposes only the Nginx gateway on host port `8000`. API containers use the internal Docker network, so replicas do not compete for host ports.

Start three APIs and four workers:

```bash
docker compose up --build --scale api=3 --scale worker=4
```

Repeated liveness requests expose the serving replica:

```bash
curl http://localhost:8000/health
```

The response contains `instanceId`, normally derived from the container hostname.

The bundled Nginx configuration dynamically resolves the Docker `api` service. Production deployments should normally use the platform load balancer/ingress rather than treating the bundled Nginx file as a universal production ingress.

## Environment safety

`APP_ENV` accepts only:

```text
development
test
production
```

Unknown values fail startup. A typo such as `APP_ENV=prodution` therefore cannot silently enable Swagger, development error exposure, or development rate-limit defaults.

The API enables credentialed CORS. For that reason `CORS_ORIGIN=*` is rejected in production. Use an explicit comma-separated list of trusted frontend origins, or leave CORS disabled when the API does not need browser cross-origin access.

## PostgreSQL configuration and pool sizing

Database configuration is validated only when a process imports `DatabaseModule`. Configure either `DATABASE_URL` or the complete host/user/password/database field set.

`DATABASE_URL` is passed to the PostgreSQL driver intact, so TLS and managed-database query parameters are preserved.

`DB_POOL_MAX` is the maximum pool size for each process that imports `DatabaseModule`:

```text
application DB connections ≈ DB-using replicas × DB_POOL_MAX
```

With the starter as shipped, only API replicas import the database module. For example:

```text
5 API replicas
DB_POOL_MAX=10
upper bound ≈ 50 application PostgreSQL connections
```

Leave headroom for migrations, administration and monitoring. At larger scale, use a managed pooler or PgBouncer rather than continually increasing PostgreSQL connection counts.

### Production schema safety

`DB_SYNC` is strictly parsed. In production, enabling it is a startup error:

```text
APP_ENV=production
DB_SYNC=1
→ application refuses to boot
```

Use migrations for production schema changes.

## Database migrations

The starter includes a dedicated TypeORM CLI data source. Runtime entity discovery and migration execution are deliberately separate: application replicas never auto-run migrations during startup.

Inspect pending/applied migrations:

```bash
pnpm run migration:show
```

Create an empty migration:

```bash
pnpm run migration:create -- src/modules/database/migrations/CreateUsers
```

Generate a migration after adding/changing entities:

```bash
pnpm run migration:generate -- src/modules/database/migrations/UpdateSchema
```

Run migrations as a dedicated deployment/release step:

```bash
APP_ENV=production DB_SYNC=0 pnpm run migration:run
```

Revert the most recent migration when appropriate:

```bash
pnpm run migration:revert
```

Do not run migration commands concurrently from every API replica. In production, execute them from one controlled release job/task before or during deployment according to your rollout strategy.

## Distributed rate limiting

All API replicas consume from the same Redis sliding window for a route + client IP.

```env
RATE_LIMIT_MAX=600
RATE_LIMIT_TTL_SECONDS=60
RATE_LIMIT_FAIL_OPEN=0
```

The Lua operation is atomic and bounded. Once a window contains `RATE_LIMIT_MAX` accepted entries, blocked requests are not appended to the sorted set, so rejected traffic cannot grow one rate-limit key without bound.

The script is registered through ioredis `defineCommand`, allowing Redis script caching instead of transmitting the full Lua script for every request.

Redis outage logs are state-aware and throttled per replica rather than emitted on every failed request.

### Fail-closed vs fail-open

With the default:

```env
RATE_LIMIT_FAIL_OPEN=0
```

Redis loss causes rate-limited requests to return `503` and `/health/ready` to return non-200. This favors quota/security consistency.

With:

```env
RATE_LIMIT_FAIL_OPEN=1
```

Redis loss allows requests to continue and `/health/ready` remains `200`, with Redis reported as `degraded`. This favors API availability. Choose deliberately based on the product's abuse and availability requirements.

The example Nginx gateway does not retry application `503` responses across every API replica, avoiding cascading retries during a shared Redis outage.

Health and metrics endpoints are excluded from rate limiting.

## Health contracts

`/health` and `/health/live` are process liveness checks. They do not depend on PostgreSQL or Redis.

`/health/ready` answers whether the instance should receive traffic:

- PostgreSQL is always required for the API.
- Redis is required when rate limiting is fail-closed.
- Redis may be `degraded` while readiness remains healthy when fail-open is explicitly enabled.

Dependency probes have their own timeout:

```env
DEPENDENCY_CHECK_TIMEOUT_MS=2000
```

`/health/dependencies` reports PostgreSQL and Redis state without applying load-balancer readiness policy. It is useful for diagnostics.

## Metrics

`GET /metrics` returns raw Prometheus text and is intentionally not wrapped by the global JSON response interceptor.

It exposes dependency-free process-level metrics including:

- process uptime
- resident memory
- Node heap used/total
- process user/system CPU time
- `instance_id` labels for replica visibility

The endpoint contains no application secrets, but production deployments should still restrict it at the ingress/network layer to the monitoring system when metrics should not be public.

This is a lightweight baseline rather than a replacement for full observability. Add request histograms, business metrics, distributed tracing and OpenTelemetry when the application needs them.

## Reverse proxy and client IP security

Fastify uses `request.ip` for the distributed rate-limit key. `TRUST_PROXY` supports:

```env
TRUST_PROXY=0          # trust no proxy
TRUST_PROXY=1          # trust exactly one proxy hop
TRUST_PROXY=10.0.0.0/8 # explicit trusted network
```

The bundled Docker topology uses one Nginx hop, so Compose sets `TRUST_PROXY=1`. Nginx overwrites `X-Forwarded-For` with the remote address it observes instead of forwarding an arbitrary client-supplied XFF chain. This prevents callers from rotating forged XFF values to bypass the example IP quota.

For a production ingress chain, configure the real trusted proxy addresses/hops and normalize forwarded headers at the outer trusted edge.

## Redis connection configuration

`REDIS_URL` is preferred:

```env
REDIS_URL=redis://localhost:6379/0
```

Managed TLS Redis can use `rediss://`. The same Redis configuration namespace is used by the distributed limiter and Bull so protocol/TLS semantics do not diverge between modules.

Host/port/user/password fields remain available when a URL is not supplied.

## HTTP limits and timeouts

```env
HTTP_BODY_LIMIT_BYTES=1048576
HTTP_REQUEST_TIMEOUT_MS=30000
HTTP_CONNECTION_TIMEOUT_MS=10000
HTTP_KEEP_ALIVE_TIMEOUT_MS=65000
DEPENDENCY_CHECK_TIMEOUT_MS=2000
```

Keep external load-balancer timeouts aligned with the application. Long-running work should normally move to Bull rather than holding HTTP connections open.

## Worker and queue behavior

The sample worker does not require PostgreSQL. It can boot with Redis configuration only.

Each worker process can process multiple jobs concurrently:

```env
WORKER_CONCURRENCY=10
```

The sample producer demonstrates safe bounded defaults:

```text
attempts: 3
backoff: exponential, 1 second base
job timeout: 30 seconds
bounded completed/failed history
```

These are starter defaults, not universal values. Tune attempts, timeout and concurrency to the idempotency and cost of each real job type.

Scale workers independently:

```bash
docker compose up --scale api=3 --scale worker=8
```

I/O-bound jobs can usually use higher concurrency than CPU-heavy jobs. CPU-heavy work may need lower per-process concurrency or dedicated worker tiers.

## Load smoke

A dependency-free Node 20 load-smoke script provides a fast capacity regression check without adding a benchmark framework to the starter:

```bash
LOAD_URL=http://localhost:8000/health \
LOAD_REQUESTS=1000 \
LOAD_CONCURRENCY=50 \
LOAD_P95_MAX_MS=250 \
LOAD_MIN_INSTANCES=1 \
pnpm run test:load
```

It prints request count, failures, reached replicas, and p50/p95/p99 latency. CI uses it behind the three-replica Nginx topology and requires at least two serving replicas.

This smoke test is a regression guard, not a capacity certification. Establish real baselines on production-like infrastructure with realistic endpoints and payloads before setting service SLOs.

## Main environment settings

See `.env.sample` for the full set.

```env
APP_ENV=development
LOG_LEVEL=debug
PORT=8000
CORS_ORIGIN=http://localhost:3000
INSTANCE_ID=
TRUST_PROXY=0

HTTP_BODY_LIMIT_BYTES=1048576
HTTP_REQUEST_TIMEOUT_MS=30000
HTTP_CONNECTION_TIMEOUT_MS=10000
HTTP_KEEP_ALIVE_TIMEOUT_MS=65000
DEPENDENCY_CHECK_TIMEOUT_MS=2000

DATABASE_URL=postgresql://startkit:startkit@localhost:5432/startkit
DB_DEBUG=0
DB_SYNC=0
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

- use only `APP_ENV=production`;
- keep `DB_SYNC=0` and deploy schema changes through a controlled migration job;
- restrict `CORS_ORIGIN` to trusted frontends when browser CORS is needed;
- keep API instances stateless;
- store sessions, locks, quotas and shared state outside process memory;
- run API and worker tiers as separate deployments and autoscale independently;
- trust only the actual proxy chain;
- size aggregate PostgreSQL pools before raising replica counts;
- use managed/HA PostgreSQL and Redis when availability requires it;
- restrict `/metrics` at the network/ingress layer when appropriate;
- store secrets in the deployment platform rather than committed files.

## CI contracts

CI is designed to verify architecture, not just TypeScript compilation. The workflow:

1. installs from the frozen pnpm lockfile;
2. runs lint;
3. builds TypeScript;
4. runs unit tests;
5. runs PostgreSQL/Redis e2e tests, including raw `/metrics` output;
6. validates Docker Compose and Nginx;
7. builds the production image;
8. proves an invalid `APP_ENV` cannot boot;
9. proves production `DB_SYNC=1` cannot boot;
10. boots three API replicas with `DB_SYNC=0`;
11. boots the worker without database configuration;
12. boots an API against an unavailable Redis with fail-open enabled and verifies readiness reports Redis as degraded;
13. runs a p95 load smoke through Nginx and requires traffic to reach multiple replicas;
14. sends forged `X-Forwarded-For` values across replicas and verifies the shared quota still returns `200,200,200,429`.

The workflow cancels obsolete in-progress runs for the same ref and avoids duplicate feature-branch push + pull-request runs.

## Scripts

| Command | Purpose |
|---|---|
| `pnpm run start:dev` | Run the API in watch mode |
| `pnpm run start:worker:dev` | Run the worker in watch mode |
| `pnpm run build` | Compile TypeScript entrypoints |
| `pnpm run start:prod` | Run the compiled API |
| `pnpm run start:worker:prod` | Run the compiled worker |
| `pnpm run lint` | Check lint rules |
| `pnpm run lint:fix` | Fix ESLint issues |
| `pnpm run format` | Format TypeScript test/source files |
| `pnpm run test` | Run unit tests |
| `pnpm run test:e2e` | Run integration/e2e contracts |
| `pnpm run test:cov` | Generate Jest coverage |
| `pnpm run test:load` | Run dependency-free HTTP load smoke |
| `pnpm run migration:show` | Show migration state |
| `pnpm run migration:run` | Run pending migrations |
| `pnpm run migration:revert` | Revert the latest migration |
| `pnpm run migration:generate -- <path>` | Generate migration from entity changes |
| `pnpm run migration:create -- <path>` | Create an empty migration |
| `pnpm run check` | Lint, build and run unit tests |

## API responses

Normal successful controller responses are wrapped globally:

```json
{
  "data": {},
  "msg": "Operation completed",
  "status_code": 200,
  "timestamp": "2026-08-10T00:00:00.000Z"
}
```

Machine-readable endpoints can explicitly opt out of this wrapper; `/metrics` uses that mechanism to emit Prometheus text.

Unexpected production errors return a generic message and an `errorId` rather than internal exception details.

## Database schema

The starter intentionally does not create placeholder product tables. Add entities and a real migration with the first product feature. Readiness uses `SELECT 1` and does not depend on an application table.

## Deployment image

The same image can run either process:

```bash
node dist/main.js
node dist/worker.js
```

`tini` is the container entrypoint so termination signals reach Node cleanly during rolling deployments and scale-down operations.

## What this foundation does not solve automatically

Horizontal replicas and guardrails do not fix inefficient SQL, N+1 queries, missing indexes, oversized responses, synchronous CPU-heavy code, slow external providers, bad job idempotency, weak authentication/authorization, or poor product-specific data modeling.

Before scaling a real application, watch at least p95/p99 latency, error rate, CPU, memory, PostgreSQL saturation, Redis latency, queue depth, retry rate, and external-provider latency. Add application-specific metrics and tracing where those signals matter.

## Roadmap

The remaining roadmap is intentionally product-dependent rather than generic starter baggage:

1. add the first real entity + migration together with the first product feature;
2. add a complete HTTP → queue → worker example when a real asynchronous use case exists;
3. add authentication/authorization as an application module when the product requires it;
4. add OpenTelemetry/distributed tracing and richer request/business metrics when operating across services;
5. add WebSocket or scheduler modules only when the application needs them, with dedicated scaling guidance.

## License

MIT
