const target = process.env.LOAD_URL || 'http://127.0.0.1:8000/health';
const totalRequests = Number(process.env.LOAD_REQUESTS || 200);
const concurrency = Number(process.env.LOAD_CONCURRENCY || 20);
const maxP95Ms = Number(process.env.LOAD_P95_MAX_MS || 1000);
const minInstances = Number(process.env.LOAD_MIN_INSTANCES || 1);

for (const [name, value] of Object.entries({
  LOAD_REQUESTS: totalRequests,
  LOAD_CONCURRENCY: concurrency,
  LOAD_P95_MAX_MS: maxP95Ms,
  LOAD_MIN_INSTANCES: minInstances,
})) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number`);
  }
}

let nextRequest = 0;
let failures = 0;
const latencies = [];
const instances = new Set();

async function runWorker() {
  while (true) {
    const requestNumber = nextRequest;
    nextRequest += 1;
    if (requestNumber >= totalRequests) {
      return;
    }

    const startedAt = performance.now();
    try {
      const response = await fetch(target);
      const elapsedMs = performance.now() - startedAt;
      latencies.push(elapsedMs);

      if (!response.ok) {
        failures += 1;
        continue;
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const body = await response.json();
        const instanceId = body?.data?.instanceId;
        if (instanceId) {
          instances.add(instanceId);
        }
      }
    } catch {
      failures += 1;
      latencies.push(performance.now() - startedAt);
    }
  }
}

await Promise.all(
  Array.from(
    { length: Math.min(concurrency, totalRequests) },
    () => runWorker(),
  ),
);

latencies.sort((a, b) => a - b);
const percentile = (fraction) => {
  if (latencies.length === 0) {
    return Infinity;
  }
  const index = Math.min(
    latencies.length - 1,
    Math.max(0, Math.ceil(latencies.length * fraction) - 1),
  );
  return latencies[index];
};

const result = {
  target,
  requests: totalRequests,
  concurrency,
  failures,
  instances: [...instances],
  p50Ms: Number(percentile(0.5).toFixed(2)),
  p95Ms: Number(percentile(0.95).toFixed(2)),
  p99Ms: Number(percentile(0.99).toFixed(2)),
};

console.log(JSON.stringify(result, null, 2));

if (failures > 0) {
  throw new Error(`Load smoke had ${failures} failed requests`);
}
if (result.p95Ms > maxP95Ms) {
  throw new Error(`p95 ${result.p95Ms}ms exceeded ${maxP95Ms}ms`);
}
if (instances.size < minInstances) {
  throw new Error(
    `Reached ${instances.size} instances; expected at least ${minInstances}`,
  );
}
