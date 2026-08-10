# Startkit Nest

A production-minded NestJS starter for horizontally scalable Fastify APIs and background workers. The foundation includes PostgreSQL, Redis, Bull queues, strict configuration validation, structured logging, health contracts, protected Prometheus-compatible metrics, TypeORM migrations, Docker/Nginx examples, and multi-replica failure-policy tests.

The starter deliberately avoids product-specific authentication, entities, business DTOs, WebSockets, schedulers, and third-party integrations. Add those as explicit application modules when the product actually needs them.

## Core properties

- Fastify-based NestJS API
- Separate API and worker entrypoints
- Strict TypeScript with `strict`, `noUncheckedIndexedAccess`, unused-code checks, and casing checks
- Type-aware ESLint for source and tests
- PostgreSQL through TypeORM with bounded per-process pools
- Redis-backed distributed sliding-window rate limiting shared by all API replicas
- Bull worker tier that waits for Redis/queue readiness before reporting startup success
- One Redis connection resolver for both API Redis and Bull
- Bounded API-path Redis connect and command timeouts
- Fail-open/fail-closed Redis outage policy with rate-limiter recovery cooldown
- Liveness, readiness, protected dependency diagnostics, and protected raw metrics
- TypeORM migration CLI using the same production image
- Strict production CORS, proxy-trust, database-sync, and internal-token guardrails
- Structured logging with sensitive headers and production request URLs redacted
- Query strings stripped from request/error log messages
- Nginx multi-replica example with spoof-resistant client IP handling
- Dependency-free load smoke with p50/p95/p99 output
- GitHub Actions contracts for lint, build, tests, Docker, failure modes, workers, migrations, and horizontal scaling
- Weekly Dependabot checks for npm, Actions, and Docker images

## Requirements

- Node.js **20.6+**
- pnpm **9.15.9**
- PostgreSQL 16+
- Redis 7+
- Docker when using the bundled Compose/CI smoke topology

The repository pins pnpm in `package.json`, CI, and the Docker build so the package manager does not drift between environments.

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

Shared coordination state stays outside API processes. Persistent application state belongs in PostgreSQL; rate-limit state and Bull queues live in Redis. The sample worker does not import `DatabaseModule`, does not open a PostgreSQL pool, and does not receive API/database secrets in the bundled Compose topology.

## Source layout

```text
src/
├── main.ts                         # Fastify API bootstrap
├── worker.ts                       # Worker bootstrap
├── app.module.ts                   # API root module
├── worker-app.module.ts            # Worker root module
├── core/                           # config, logging, HTTP/network safety
├── modules/
│   ├── api/                        # controllers, guard, filter, interceptor
│   ├── database/
│   │   ├── configs/                # runtime DB config
│   │   ├── data-source.ts          # TypeORM CLI data source
│   │   └── migrations/             # application migrations
│   ├── queue/                      # Bull config and producers
│   ├── redis/                      # shared Redis resolver/client
│   └── worker/                     # queue consumers and startup readiness
└── shared/                         # neutral contracts/decorators/constants

scripts/
├── typeorm-cli.mjs                 # environment-aware TypeORM CLI runner
└── ci-smoke.sh                     # reusable Docker failure/scaling smoke

test/
├── app.e2e-spec.ts                 # API + PostgreSQL + Redis contracts
└── load-smoke.mjs                  # dependency-free HTTP load smoke
```

## Local development

```bash
cp .env.sample .env
pnpm install

docker compose up -d postgres redis
pnpm run start:dev
```

Run the worker in another terminal:

```bash
pnpm run start:worker:dev
```

Useful development endpoints:

```text
GET /                    service info + instanceId, rate limited
GET /health              backwards-compatible liveness
GET /health/live         explicit liveness
GET /health/ready        traffic readiness
GET /health/dependencies dependency diagnostics
GET /metrics             raw Prometheus-compatible process metrics
GET /docs                Swagger, non-production only
```

## Environment safety

`APP_ENV` accepts only:

```text
development
test
production
```

Unknown values fail startup. A typo such as `prodution` cannot silently switch the application into development behavior.

`LOG_LEVEL` is also whitelist validated. Numeric ports, pool sizes, timeouts, Redis database indexes, worker concurrency, and recovery settings fail fast when malformed instead of silently falling back.

See `.env.sample` for the canonical list and defaults.

## CORS

Use a comma-separated list of exact HTTP/HTTPS origins:

```env
CORS_ORIGIN=https://app.example.com,https://admin.example.com
```

Origins with paths are rejected. In production, `*` is rejected because credentialed wildcard CORS is unsafe.

For local/test use only, `CORS_ORIGIN=*` is allowed and the runtime automatically disables credentials for that wildcard mode.

Leave `CORS_ORIGIN` empty when browser cross-origin access is not needed.

## Reverse proxy and client IP safety

Fastify uses `request.ip` for the distributed rate-limit key.

```env
TRUST_PROXY=0
TRUST_PROXY=1
TRUST_PROXY=10.0.0.0/8
TRUST_PROXY=2001:db8::/32
```

- `0` / `false`: trust no proxy
- positive integer: trust that many hops
- IP/CIDR: trust the explicit proxy/network
- `true`: accepted only outside production

Production rejects `TRUST_PROXY=true`. Malformed values are rejected before Fastify bootstrap.

The bundled Nginx example overwrites `X-Forwarded-For` with the remote address it observes instead of forwarding arbitrary caller-supplied XFF chains. Configure the real trusted topology when deploying behind a cloud ingress/load balancer.

## PostgreSQL

Configure either `DATABASE_URL` or the complete host-mode field set.

`DATABASE_URL` is passed to the PostgreSQL driver intact so TLS and managed-database query parameters are not lost.

### Pool sizing

`DB_POOL_MAX` applies per process that imports `DatabaseModule`:

```text
maximum application DB connections ≈ DB-using replicas × DB_POOL_MAX
```

The sample API imports the database module; the sample worker does not.

### Production schema safety

`DB_SYNC` is strictly parsed. Production refuses to boot when synchronization is enabled:

```text
APP_ENV=production
DB_SYNC=1
→ startup failure
```

Use controlled migrations instead.

## Database migrations

The starter has a dedicated TypeORM CLI data source. Application replicas never auto-run migrations on startup.

```bash
pnpm run migration:show
pnpm run migration:create -- src/modules/database/migrations/CreateUsers
pnpm run migration:generate -- src/modules/database/migrations/UpdateSchema
pnpm run migration:run
pnpm run migration:revert
```

The CLI runner loads local `.env` when that file exists. Deployment-provided environment variables continue to be used in release jobs, and the production Docker image includes the migration runner.

Run production migrations from **one controlled release task**, not concurrently from every API replica.

## Redis connection behavior

Prefer a URL:

```env
REDIS_URL=redis://localhost:6379/0
```

`rediss://` URLs are preserved intact. Host/port/user/password mode remains available when a URL is not configured.

API Redis and Bull both use the same connection resolver, so protocol/host/database semantics cannot silently diverge between the two paths.

API request-path Redis operations have explicit bounds:

```env
REDIS_CONNECT_TIMEOUT_MS=5000
REDIS_COMMAND_TIMEOUT_MS=2000
```

Those bounds prevent a Redis outage from holding request-path operations indefinitely.

## Distributed rate limiting

```env
RATE_LIMIT_MAX=600
RATE_LIMIT_TTL_SECONDS=60
RATE_LIMIT_RETRY_COOLDOWN_MS=1000
RATE_LIMIT_FAIL_OPEN=0
```

The limiter uses an atomic Redis Lua sliding window. Accepted entries are bounded by the configured quota; rejected traffic does not append unlimited records to the sorted set.

The Lua command is registered through ioredis `defineCommand`, and returned values are validated before the API uses them.

When Redis becomes unavailable, the guard enters a per-replica recovery cooldown. Requests fail fast during the cooldown and only one request per window probes recovery, avoiding a reconnect thundering herd.

### Fail-closed

Default:

```env
RATE_LIMIT_FAIL_OPEN=0
```

- rate-limited routes return `503` when Redis is unavailable
- `/health/ready` becomes non-ready
- favors quota/security consistency

### Fail-open

```env
RATE_LIMIT_FAIL_OPEN=1
```

- traffic may continue while Redis is unavailable
- `/health/ready` stays `200`
- readiness reports Redis as `degraded`
- favors API availability

Choose this deliberately based on abuse risk and availability requirements.

## Health contracts

### Liveness

`/health` and `/health/live` only answer whether the API process is alive. They do not probe shared dependencies.

### Readiness

`/health/ready` answers whether the instance should receive traffic:

- PostgreSQL is always required by the sample API
- Redis is required in fail-closed mode
- Redis may be `degraded` while readiness remains healthy only when fail-open is explicitly enabled

Dependency probes are bounded:

```env
DEPENDENCY_CHECK_TIMEOUT_MS=2000
```

### Protected dependency diagnostics

`/health/dependencies` reports PostgreSQL and Redis state without applying readiness policy.

Outside production it is available directly. In production it is an internal endpoint governed by `INTERNAL_ENDPOINT_TOKEN`.

## Metrics and internal endpoint protection

`GET /metrics` returns raw Prometheus-compatible text and opts out of the global JSON response envelope.

Current dependency-free process metrics include:

- uptime
- resident memory
- Node heap used/total
- user/system CPU time
- `instance_id` label

Production `/metrics` and `/health/dependencies` follow this policy:

```env
INTERNAL_ENDPOINT_TOKEN=
```

- empty/unset: the endpoints are hidden with `404`
- configured: token must be at least 32 characters
- callers must send `Authorization: Bearer <token>`
- invalid/missing bearer token returns `401`

Use a deployment secret store for the token. In high-security environments, network/ingress restrictions can be layered on top of this application-level control.

## Worker and queue behavior

The sample worker needs Redis but not PostgreSQL.

```env
WORKER_CONCURRENCY=10
WORKER_STARTUP_TIMEOUT_MS=10000
```

Worker bootstrap waits for Bull `queue.isReady()`. If Bull cannot become Redis-ready within `WORKER_STARTUP_TIMEOUT_MS`, application bootstrap fails rather than logging a false healthy startup state.

The bundled Compose worker also has a Redis healthcheck after startup.

Sample job defaults are deliberately bounded:

```text
attempts: 3
backoff: exponential, 1 second base
job timeout: 30 seconds
completed history: 20
failed history: 50
```

The sample consumer logs job metadata only, not the queue payload content.

Scale independently:

```bash
docker compose up --scale api=3 --scale worker=8
```

Tune concurrency/retries/timeouts for each real job's idempotency, latency, and cost profile.

## Docker Compose topology

Start the example topology:

```bash
docker compose up --build --scale api=3 --scale worker=4
```

Important local-safety details:

- only Nginx exposes the public application port `8000`
- API replicas use internal Docker ports
- PostgreSQL and Redis host ports are bound to `127.0.0.1`, not all host interfaces
- the worker does not load the API `.env` file and therefore does not receive database/API-only secrets in the sample topology
- API and worker use the same production image with different commands

For real production, prefer the deployment platform's ingress/load balancer rather than treating the bundled Nginx file as a universal ingress solution.

## HTTP limits and timeouts

```env
HTTP_BODY_LIMIT_BYTES=1048576
HTTP_REQUEST_TIMEOUT_MS=30000
HTTP_CONNECTION_TIMEOUT_MS=10000
HTTP_KEEP_ALIVE_TIMEOUT_MS=65000
DEPENDENCY_CHECK_TIMEOUT_MS=2000
```

Keep upstream load-balancer timeouts aligned. Long-running work should normally move to a queue instead of holding an HTTP request open.

## Logging privacy

Production logging redacts common sensitive headers, including authorization, cookies, API keys, proxy authorization, and set-cookie values.

Raw production request URLs are redacted from structured request objects, and human-readable request/error log messages strip query strings. This prevents accidental query parameters such as callback codes or tokens from being written into routine logs.

The sample worker avoids logging job payload content.

## API response contracts

Successful controller responses are wrapped globally:

```json
{
  "data": {},
  "msg": "Operation completed",
  "status_code": 200,
  "timestamp": "2026-08-10T00:00:00.000Z"
}
```

Machine-readable routes can opt out; `/metrics` does so to emit raw text.

Client errors use the same snake-case status field:

```json
{
  "status_code": 400,
  "message": "Invalid request",
  "timestamp": "2026-08-10T00:00:00.000Z"
}
```

Unexpected production 5xx responses do not expose internal exception details:

```json
{
  "status_code": 500,
  "message": "Internal server error",
  "error_id": "...",
  "timestamp": "2026-08-10T00:00:00.000Z"
}
```

Use `error_id` to correlate the user-visible failure with server logs.

## Load regression smoke

A dependency-free Node script provides a fast regression guard:

```bash
LOAD_URL=http://localhost:8000/health \
LOAD_REQUESTS=1000 \
LOAD_CONCURRENCY=50 \
LOAD_P95_MAX_MS=250 \
LOAD_MIN_INSTANCES=1 \
pnpm run test:load
```

It reports failures, serving replica IDs, p50, p95, and p99. This is a regression smoke test, not a production capacity certification.

## CI contracts

The workflow uses least-privilege `contents: read`, cancels obsolete runs for the same ref, and has a 30-minute job timeout.

It verifies:

1. frozen pnpm install with the pinned package-manager version
2. type-aware ESLint
3. strict TypeScript build
4. unit tests
5. PostgreSQL/Redis e2e tests
6. Docker Compose validation
7. Nginx configuration validation
8. production image build
9. invalid `APP_ENV` fails startup for the expected reason
10. production wildcard CORS fails startup
11. production `TRUST_PROXY=true` fails startup
12. production `DB_SYNC=1` fails startup
13. the production image can execute the migration CLI
14. three API replicas become ready
15. protected metrics reject unauthenticated access and accept the configured token
16. protected dependency diagnostics report connected dependencies
17. a worker without DB configuration reaches Bull readiness
18. fail-open API readiness tolerates an unavailable Redis and reports `degraded`
19. the Nginx gateway reaches multiple replicas under load
20. spoofed `X-Forwarded-For` values cannot bypass the shared Redis quota

The Docker/failure portion lives in `scripts/ci-smoke.sh`, which can also be run manually in an equivalent environment. It installs an EXIT trap so containers/network are cleaned even when an assertion fails.

## Scripts

| Command | Purpose |
|---|---|
| `pnpm run start:dev` | Run API in watch mode |
| `pnpm run start:worker:dev` | Run worker in watch mode |
| `pnpm run build` | Strict TypeScript build |
| `pnpm run start:prod` | Run compiled API |
| `pnpm run start:worker:prod` | Run compiled worker |
| `pnpm run lint` | Run type-aware lint rules |
| `pnpm run lint:fix` | Apply ESLint fixes |
| `pnpm run format` | Format TypeScript source/tests |
| `pnpm run test` | Unit tests |
| `pnpm run test:e2e` | Integration/e2e tests |
| `pnpm run test:cov` | Jest coverage |
| `pnpm run test:load` | HTTP load regression smoke |
| `pnpm run migration:show` | Show migration state |
| `pnpm run migration:run` | Run pending migrations |
| `pnpm run migration:revert` | Revert latest migration |
| `pnpm run migration:generate -- <path>` | Generate migration from entity changes |
| `pnpm run migration:create -- <path>` | Create empty migration |
| `pnpm run check` | Lint + build + unit tests |

## Database schema

The starter intentionally does not ship placeholder product tables. Add the first real entity and migration together with the first product feature. Readiness uses `SELECT 1` and does not depend on an application table.

## Deployment image

The same non-root image can run API, worker, or migration jobs:

```bash
node dist/main.js
node dist/worker.js
node scripts/typeorm-cli.mjs migration:run
```

`tini` is the image entrypoint so termination signals reach Node during rolling deployments and scale-down.

## What remains product-specific

The foundation intentionally does not attempt to solve application-specific concerns such as inefficient SQL, missing indexes, authorization models, idempotency keys, WebSocket state, scheduler ownership, third-party provider resilience, or business SLOs.

Add those with the feature that creates the requirement instead of carrying unused generic infrastructure in the starter.

## License

MIT
