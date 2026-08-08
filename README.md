# Startkit Nest

A production-minded NestJS starter kit designed for horizontal scaling with a Fastify HTTP API, independent Bull workers, PostgreSQL, Redis, structured logging, health checks, validation, and automated multi-replica tests.

## What this starter provides

- Fastify-based NestJS API
- Separate stateless API and worker entrypoints
- PostgreSQL through TypeORM with bounded per-process connection pools
- Redis-backed distributed rate limiting shared by all API replicas
- Bull queues with independently scalable workers
- One shared Redis connection configuration for `redis://` and `rediss://`
- Configurable worker concurrency
- Liveness and PostgreSQL + Redis readiness endpoints
- Replica-aware structured logging and service responses
- Request body, connection, request, and keep-alive timeouts
- Reverse-proxy-aware client IP handling with bounded trusted-hop support
- Nginx load-balancer example for local multi-replica Docker Compose
- Graceful container signal handling through `tini`
- Swagger in non-production environments
- Unit, end-to-end, Docker, Nginx, and three-replica scaling checks in GitHub Actions

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
                                          │
                                      Bull queues
                                          │
                                  ┌───────┴───────┐
                               Worker #1       Worker #M
```

API coordination state is outside the process. Rate-limit counters live in Redis and persistent application data lives in PostgreSQL. Workers consume Bull queues from Redis and scale independently from API replicas.

The starter deliberately avoids opening infrastructure connections that the current process does not need: the API does not initialize Bull/cache clients until a feature imports them, and the sample worker does not initialize a PostgreSQL pool because its sample job does not use the database.

## Source layout

```text
src/
├── main.ts                 # Fastify API entrypoint
├── worker.ts               # Background worker entrypoint
├── app.module.ts           # API application root
├── worker-app.module.ts    # Worker application root
├── core/                   # Global configuration, HTTP options and logging
├── modules/
│   ├── api/                # Controllers, filters, guards and interceptors
│   ├── database/           # TypeORM connection infrastructure
│   ├── queue/              # Bull infrastructure and producers
│   ├── redis/              # Shared Redis configuration/client
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

Useful endpoints:

```text
GET http://localhost:8000/                # rate-limited service info + instanceId
GET http://localhost:8000/health          # liveness, not rate limited
GET http://localhost:8000/health/ready    # PostgreSQL + Redis readiness
GET http://localhost:8000/docs            # non-production only
```

## Horizontal scaling with Docker Compose

The Compose topology exposes only the Nginx gateway on host port `8000`. API containers use the internal Docker network, so replicas do not compete for a host port.

Start three APIs and four workers:

```bash
docker compose up --build --scale api=3 --scale worker=4
```

Repeated requests expose the serving replica:

```bash
curl http://localhost:8000/health
```

The response contains `instanceId`, normally derived from the container hostname.

The bundled Nginx configuration dynamically resolves the Docker `api` service. Production deployments should use the platform load balancer/ingress (ALB, Kubernetes ingress, ECS, Nomad, etc.) rather than treating the bundled Nginx file as a universal production ingress.

## PostgreSQL pool sizing

`DB_POOL_MAX` is the maximum pool size for every process that imports `DatabaseModule`.

With the starter as shipped, API replicas import the database module and the sample worker does not, so the planning upper bound is approximately:

```text
application DB connections ≈ API replicas × DB_POOL_MAX
```

If a real worker later imports `DatabaseModule`, include those worker replicas as well.

Example:

```text
5 API replicas
DB_POOL_MAX=10
upper bound ≈ 50 PostgreSQL connections
```

Leave headroom for migrations, administration and monitoring. At larger scale, use a managed pooler or PgBouncer rather than continually increasing PostgreSQL connection counts.

`DATABASE_URL` is passed to the PostgreSQL driver intact, so connection-string options such as TLS/managed-database parameters are not discarded by a custom URL parser.

## Distributed rate limiting

All API replicas consume from the same Redis sliding window for a route + client IP.

```env
RATE_LIMIT_MAX=600
RATE_LIMIT_TTL_SECONDS=60
RATE_LIMIT_FAIL_OPEN=0
```

The Lua operation is atomic and bounded: once a window contains `RATE_LIMIT_MAX` accepted entries, blocked requests are **not** appended to the sorted set. A flood of rejected requests therefore cannot grow one rate-limit key without bound.

With `RATE_LIMIT_FAIL_OPEN=0`, loss of Redis returns `503`. Per-request outage logs are throttled on each replica, and the example Nginx gateway does not retry application `503` responses across every API replica.

Health endpoints are excluded from rate limiting so infrastructure probes do not consume quota.

## Reverse proxy and client IP security

Fastify uses `request.ip` for the distributed rate-limit key. `TRUST_PROXY` supports:

```env
TRUST_PROXY=0          # trust no proxy
TRUST_PROXY=1          # trust exactly one proxy hop
TRUST_PROXY=10.0.0.0/8 # explicit trusted network
```

The bundled Docker topology uses one Nginx hop, so Compose sets `TRUST_PROXY=1`. The bundled Nginx config overwrites `X-Forwarded-For` with its observed remote address instead of forwarding an arbitrary client-supplied XFF chain. This prevents a caller from rotating a forged XFF value to bypass the IP quota in the example topology.

For a production ingress chain, configure the real trusted proxy addresses/hops and normalize forwarded headers at the outer trusted edge.

## Redis connection configuration

`REDIS_URL` is the preferred setting:

```env
REDIS_URL=redis://localhost:6379/0
```

Managed TLS Redis can use a `rediss://` URL. The same Redis configuration namespace is used by the distributed limiter and Bull, so protocol/TLS semantics do not diverge between modules.

Host/port/user/password fields remain available when a URL is not supplied.

## HTTP limits and timeouts

```env
HTTP_BODY_LIMIT_BYTES=1048576
HTTP_REQUEST_TIMEOUT_MS=30000
HTTP_CONNECTION_TIMEOUT_MS=10000
HTTP_KEEP_ALIVE_TIMEOUT_MS=65000
```

Keep load-balancer and application timeouts aligned. Long-running work should normally move to Bull rather than holding HTTP connections open.

## Worker scaling

Each worker process can process multiple jobs concurrently:

```env
WORKER_CONCURRENCY=10
```

Scale workers independently:

```bash
docker compose up --scale api=3 --scale worker=8
```

Choose concurrency based on the job type. I/O-bound jobs can usually use higher concurrency than CPU-heavy jobs.

## Environment

See `.env.sample` for the full set. Main scaling settings:

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
- Store sessions, locks, quotas and shared state outside process memory.
- Run API and worker tiers as separate deployments and autoscale independently.
- Trust only the actual proxy chain; never blindly accept arbitrary forwarded headers.
- Size aggregate PostgreSQL pools before raising replica counts.
- Use managed/HA PostgreSQL and Redis when availability requires it.
- Store secrets in the deployment platform rather than committed files.

## Sample queue

`QueueService.addSampleJob()` demonstrates a Bull producer and `SampleConsumer` demonstrates a worker processor. The API root does not import the queue module merely to keep this example alive; a real feature should import/enqueue through the queue module when it actually needs background work.

## CI scaling verification

CI does more than compile the topology. It:

1. installs from the frozen pnpm lockfile;
2. builds TypeScript;
3. runs unit and PostgreSQL/Redis end-to-end tests;
4. validates Docker Compose and Nginx;
5. builds the production image;
6. boots three API containers behind a real Nginx container;
7. verifies the gateway reaches multiple `instanceId` values;
8. sends forged `X-Forwarded-For` values while crossing replicas and verifies the shared quota still returns `200,200,200,429`.

This smoke test catches regressions in proxy trust, distributed quota storage and Docker DNS/load balancing that a single-process e2e test cannot catch.

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
| `pnpm run check` | Run lint, build and unit tests |

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

Unexpected production errors return a generic message and an `errorId`.

## Database schema

The starter does not create placeholder tables. Add entities and TypeORM migrations with the first real feature. Readiness uses `SELECT 1` and does not depend on an application table.

## Deployment image

The same image can run either process:

```bash
node dist/main.js
node dist/worker.js
```

`tini` is the container entrypoint so termination signals reach Node cleanly during rolling deployments and scale-down operations.

## What horizontal scalability does not solve

Replicas do not fix inefficient SQL, N+1 queries, missing indexes, oversized responses, synchronous CPU-heavy code or slow external providers. Benchmark real endpoints and watch p95/p99 latency, error rate, CPU, memory, PostgreSQL saturation, Redis latency and queue depth before deciding the next scaling step.

## Roadmap

1. TypeORM migration commands and a real example feature migration
2. Complete HTTP → queue → worker feature example
3. Authentication as an optional application module
4. Metrics endpoint and OpenTelemetry/Prometheus integration
5. k6 load-test scenarios and documented capacity baselines
6. Optional WebSocket and scheduler modules with dedicated scaling guidance

## License

MIT
