import Redis from "ioredis";

let _client: Redis | null = null;

export function getRedis(): Redis | null {
  if (!process.env.REDIS_URL) return null;
  if (!_client) {
    _client = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
    });
    _client.on("error", () => {
      // swallow errors — Redis is a cache, not a critical dependency
    });
  }
  return _client;
}

const DEFAULT_TTL = 60; // seconds

export async function cacheGet(key: string): Promise<string | null> {
  try {
    return await getRedis()?.get(key) ?? null;
  } catch {
    return null;
  }
}

export async function cacheSet(
  key: string,
  value: string,
  ttlSeconds = DEFAULT_TTL,
): Promise<void> {
  try {
    await getRedis()?.setex(key, ttlSeconds, value);
  } catch {
    // ignore
  }
}

export async function cacheDel(key: string): Promise<void> {
  try {
    await getRedis()?.del(key);
  } catch {
    // ignore
  }
}
