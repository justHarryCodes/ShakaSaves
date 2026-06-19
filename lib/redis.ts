import IORedis from "ioredis";

let _client: IORedis | null = null;

function getClient(): IORedis {
  if (!_client) {
    _client = new IORedis(process.env.REDIS_URL!, {
      maxRetriesPerRequest: 1,   // fail fast per command; errors caught in callers
      enableReadyCheck: false,
      lazyConnect: true,         // don't connect at module load — wait for first command
      tls: undefined,            // SSL not enabled on this server
      retryStrategy: (times) => times > 2 ? null : Math.min(times * 200, 1000),
    });
    // Attach error handler to prevent Node from treating connection errors as
    // unhandled exceptions. All command errors are caught in try/catch above.
    _client.on("error", () => {});
  }
  return _client;
}

export const redis = new Proxy({} as IORedis, {
  get(_target, prop) {
    return (getClient() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

const IDEMPOTENCY_TTL = 86400; // 24 hours
const WINDOW_MS = 60_000; // 1 minute

async function rateLimit(
  prefix: string,
  identifier: string,
  limit: number,
): Promise<{ success: boolean; remaining: number }> {
  try {
    const client = getClient();
    const key = `${prefix}:${identifier}`;
    const now = Date.now();
    const windowStart = now - WINDOW_MS;

    const pipeline = client.pipeline();
    pipeline.zremrangebyscore(key, 0, windowStart);
    pipeline.zadd(key, now, `${now}-${Math.random()}`);
    pipeline.zcard(key);
    pipeline.expire(key, 60);
    const results = await pipeline.exec();

    const count = (results?.[2]?.[1] as number) ?? 0;
    return { success: count <= limit, remaining: Math.max(0, limit - count) };
  } catch {
    // Redis unavailable — fail open so auth/registration still works
    return { success: true, remaining: limit };
  }
}

export const globalRateLimiter = {
  limit: (identifier: string) => rateLimit("rl:global", identifier, 60),
};

export const financialRateLimiter = {
  limit: (identifier: string) => rateLimit("rl:financial", identifier, 10),
};

export async function checkIdempotencyKey(key: string): Promise<string | null> {
  try {
    return await getClient().get(`idempotency:${key}`);
  } catch {
    return null;
  }
}

export async function storeIdempotencyKey(key: string, resultId: string): Promise<void> {
  try {
    await getClient().set(`idempotency:${key}`, resultId, "EX", IDEMPOTENCY_TTL);
  } catch {
    // non-fatal — idempotency best-effort when Redis is down
  }
}

export function getIpFromRequest(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "127.0.0.1";
}
