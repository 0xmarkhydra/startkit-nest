#!/usr/bin/env bash
set -euo pipefail

image="${STARTKIT_CI_IMAGE:-startkit-nest:ci}"
network="${STARTKIT_CI_NETWORK:-startkit-ci}"
internal_token='startkit-ci-internal-token-0123456789abcdef'
containers=(
  startkit-invalid-env
  startkit-invalid-cors
  startkit-invalid-proxy
  startkit-invalid-dbsync
  startkit-gateway
  startkit-api-fail-open
  startkit-worker
  startkit-api-1
  startkit-api-2
  startkit-api-3
)

cleanup() {
  docker rm -f "${containers[@]}" 2>/dev/null || true
  docker network rm "$network" 2>/dev/null || true
}
trap cleanup EXIT
cleanup

docker network create "$network" >/dev/null

assert_startup_failure() {
  local name="$1"
  local expected_message="$2"
  shift 2

  docker run -d --name "$name" "$@" >/dev/null

  for attempt in $(seq 1 15); do
    if [ "$(docker inspect -f '{{.State.Running}}' "$name")" != "true" ]; then
      break
    fi
    if [ "$attempt" -eq 15 ]; then
      docker logs "$name"
      echo "$name unexpectedly remained running"
      return 1
    fi
    sleep 1
  done

  if ! docker logs "$name" 2>&1 | grep -Fq "$expected_message"; then
    docker logs "$name"
    echo "$name failed, but not for the expected guardrail: $expected_message"
    return 1
  fi

  docker rm "$name" >/dev/null
}

assert_startup_failure \
  startkit-invalid-env \
  'Invalid APP_ENV value' \
  --network "$network" \
  --add-host host.docker.internal:host-gateway \
  -e APP_ENV=prodution \
  -e DATABASE_URL=postgresql://startkit:startkit@host.docker.internal:5432/startkit \
  -e REDIS_URL=redis://host.docker.internal:6379/0 \
  "$image"

assert_startup_failure \
  startkit-invalid-cors \
  'CORS_ORIGIN cannot contain * in production' \
  --network "$network" \
  --add-host host.docker.internal:host-gateway \
  -e APP_ENV=production \
  -e CORS_ORIGIN='*' \
  -e DATABASE_URL=postgresql://startkit:startkit@host.docker.internal:5432/startkit \
  -e REDIS_URL=redis://host.docker.internal:6379/0 \
  "$image"

assert_startup_failure \
  startkit-invalid-proxy \
  'TRUST_PROXY=true is not allowed in production' \
  --network "$network" \
  --add-host host.docker.internal:host-gateway \
  -e APP_ENV=production \
  -e TRUST_PROXY=true \
  -e DATABASE_URL=postgresql://startkit:startkit@host.docker.internal:5432/startkit \
  -e REDIS_URL=redis://host.docker.internal:6379/0 \
  "$image"

assert_startup_failure \
  startkit-invalid-dbsync \
  'DB_SYNC must be disabled in production' \
  --network "$network" \
  --add-host host.docker.internal:host-gateway \
  -e APP_ENV=production \
  -e DATABASE_URL=postgresql://startkit:startkit@host.docker.internal:5432/startkit \
  -e REDIS_URL=redis://host.docker.internal:6379/0 \
  -e DB_SYNC=1 \
  "$image"

docker run --rm \
  --network "$network" \
  --add-host host.docker.internal:host-gateway \
  -e APP_ENV=production \
  -e DATABASE_URL=postgresql://startkit:startkit@host.docker.internal:5432/startkit \
  "$image" node scripts/typeorm-cli.mjs migration:show

for replica in 1 2 3; do
  docker run -d \
    --name "startkit-api-${replica}" \
    --network "$network" \
    --network-alias api \
    --add-host host.docker.internal:host-gateway \
    -e APP_ENV=production \
    -e PORT=8000 \
    -e CORS_ORIGIN=http://localhost:3000 \
    -e INSTANCE_ID="api-${replica}" \
    -e INTERNAL_ENDPOINT_TOKEN="$internal_token" \
    -e TRUST_PROXY=1 \
    -e DATABASE_URL=postgresql://startkit:startkit@host.docker.internal:5432/startkit \
    -e REDIS_URL=redis://host.docker.internal:6379/0 \
    -e DB_SYNC=0 \
    -e DB_POOL_MAX=3 \
    -e RATE_LIMIT_MAX=3 \
    -e RATE_LIMIT_TTL_SECONDS=60 \
    "$image" >/dev/null
done

for replica in 1 2 3; do
  for attempt in $(seq 1 30); do
    if docker exec "startkit-api-${replica}" node -e "fetch('http://127.0.0.1:8000/health/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"; then
      break
    fi
    if [ "$attempt" -eq 30 ]; then
      docker logs "startkit-api-${replica}"
      exit 1
    fi
    sleep 1
  done
done

docker exec startkit-api-1 node -e "fetch('http://127.0.0.1:8000/metrics').then(r=>{if(r.status!==401)process.exit(1)}).catch(()=>process.exit(1))"
docker exec startkit-api-1 node -e "fetch('http://127.0.0.1:8000/metrics',{headers:{authorization:'Bearer ${internal_token}'}}).then(async r=>{if(!r.ok)process.exit(1);const body=await r.text();if(!body.includes('startkit_process_uptime_seconds'))process.exit(1)}).catch(()=>process.exit(1))"
docker exec startkit-api-1 node -e "fetch('http://127.0.0.1:8000/health/dependencies',{headers:{authorization:'Bearer ${internal_token}'}}).then(async r=>{if(!r.ok)process.exit(1);const body=await r.json();if(body.data.database!=='connected'||body.data.redis!=='connected')process.exit(1)}).catch(()=>process.exit(1))"

# Poison the worker with invalid API/database-only settings. The worker must ignore
# them because its bootstrap role only validates shared Redis/logging + worker config.
docker run -d \
  --name startkit-worker \
  --network "$network" \
  --add-host host.docker.internal:host-gateway \
  -e APP_ENV=production \
  -e REDIS_URL=redis://host.docker.internal:6379/0 \
  -e CORS_ORIGIN='*' \
  -e TRUST_PROXY=true \
  -e INTERNAL_ENDPOINT_TOKEN=short \
  -e DB_SYNC=1 \
  -e RATE_LIMIT_RETRY_COOLDOWN_MS=0 \
  -e WORKER_CONCURRENCY=1 \
  -e WORKER_STARTUP_TIMEOUT_MS=10000 \
  "$image" node dist/worker.js >/dev/null

for attempt in $(seq 1 30); do
  if docker logs startkit-worker 2>&1 | grep -Fq 'Worker is running'; then
    break
  fi
  if [ "$(docker inspect -f '{{.State.Running}}' startkit-worker)" != "true" ]; then
    docker logs startkit-worker
    echo 'Worker exited before Bull became ready'
    exit 1
  fi
  if [ "$attempt" -eq 30 ]; then
    docker logs startkit-worker
    echo 'Worker did not report Bull readiness'
    exit 1
  fi
  sleep 1
done

docker exec startkit-worker node -e "const Redis=require('ioredis');const r=new Redis(process.env.REDIS_URL,{connectTimeout:2000,maxRetriesPerRequest:1});r.ping().then(()=>r.quit()).then(()=>process.exit(0)).catch(()=>{r.disconnect();process.exit(1)})"

docker run -d \
  --name startkit-api-fail-open \
  --network "$network" \
  --add-host host.docker.internal:host-gateway \
  -e APP_ENV=production \
  -e PORT=8000 \
  -e INSTANCE_ID=api-fail-open \
  -e DATABASE_URL=postgresql://startkit:startkit@host.docker.internal:5432/startkit \
  -e REDIS_URL=redis://host.docker.internal:6399/0 \
  -e REDIS_CONNECT_TIMEOUT_MS=500 \
  -e REDIS_COMMAND_TIMEOUT_MS=500 \
  -e RATE_LIMIT_FAIL_OPEN=1 \
  -e DEPENDENCY_CHECK_TIMEOUT_MS=500 \
  "$image" >/dev/null

for attempt in $(seq 1 30); do
  if docker exec startkit-api-fail-open node -e "fetch('http://127.0.0.1:8000/health/ready').then(async r=>{if(!r.ok)process.exit(1);const b=await r.json();if(b.data.redis!=='degraded')process.exit(1)}).catch(()=>process.exit(1))"; then
    break
  fi
  if [ "$attempt" -eq 30 ]; then
    docker logs startkit-api-fail-open
    echo 'Fail-open readiness did not tolerate Redis outage'
    exit 1
  fi
  sleep 1
done

docker run -d \
  --name startkit-gateway \
  --network "$network" \
  -p 18000:8000 \
  -v "$PWD/deploy/nginx.conf:/etc/nginx/nginx.conf:ro" \
  nginx:1.27-alpine >/dev/null

for attempt in $(seq 1 30); do
  if curl --fail --silent http://127.0.0.1:18000/health >/dev/null; then
    break
  fi
  if [ "$attempt" -eq 30 ]; then
    docker logs startkit-gateway
    exit 1
  fi
  sleep 1
done

LOAD_URL=http://127.0.0.1:18000/health \
LOAD_REQUESTS=200 \
LOAD_CONCURRENCY=20 \
LOAD_P95_MAX_MS=1000 \
LOAD_MIN_INSTANCES=2 \
pnpm run test:load

node <<'NODE'
const Redis = require('ioredis');
(async () => {
  const redis = new Redis('redis://127.0.0.1:6379/0');
  let cursor = '0';
  do {
    const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', 'startkit:rate-limit:*', 'COUNT', 100);
    cursor = nextCursor;
    if (keys.length) await redis.del(...keys);
  } while (cursor !== '0');
  await redis.quit();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
NODE

node <<'NODE'
(async () => {
  const statuses = [];
  const ids = new Set();
  for (let i = 1; i <= 4; i += 1) {
    const response = await fetch('http://127.0.0.1:18000/', {
      headers: { 'x-forwarded-for': `198.51.100.${i}` },
    });
    statuses.push(response.status);
    if (response.status === 200) {
      const body = await response.json();
      ids.add(body.data.instanceId);
    }
  }
  const expected = '200,200,200,429';
  if (statuses.join(',') !== expected) {
    throw new Error(`spoof-resistant shared limit failed: ${statuses.join(',')}`);
  }
  if (ids.size < 2) {
    throw new Error(`rate-limit requests did not cross replicas: ${[...ids].join(',')}`);
  }
  console.log(`shared limit crossed replicas: ${[...ids].join(',')}`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
NODE
