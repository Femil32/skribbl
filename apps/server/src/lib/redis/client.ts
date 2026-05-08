export interface RedisPipeline {
  hset(key: string, fields: Record<string, string>): this;
  set(key: string, value: string): this;
  expire(key: string, seconds: number): this;
  del(...keys: string[]): this;
  exec(): Promise<void>;
}

export interface RedisClient {
  hset(key: string, fields: Record<string, string>): Promise<void>;
  hgetall(key: string): Promise<Record<string, string> | null>;
  set(key: string, value: string): Promise<void>;
  get(key: string): Promise<string | null>;
  del(...keys: string[]): Promise<void>;
  expire(key: string, seconds: number): Promise<void>;
  ping(): Promise<string>;
  pipeline(): RedisPipeline;
}

// P-5: module-level singleton — multiple callers share one connection
let _client: RedisClient | null = null;

export async function getRedisClient(): Promise<RedisClient> {
  if (_client) return _client;

  const provider = process.env.REDIS_PROVIDER ?? "ioredis";

  if (provider === "upstash") {
    const { Redis } = await import("@upstash/redis");
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
      throw new Error(
        "Redis unavailable: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set when REDIS_PROVIDER=upstash",
      );
    }
    const client = new Redis({ url, token });
    _client = adaptUpstash(client);
    return _client;
  }

  // P-3: unknown provider is a misconfiguration — fail fast
  if (provider !== "ioredis") {
    throw new Error(
      `Redis unavailable: unknown REDIS_PROVIDER "${provider}" — must be "ioredis" or "upstash"`,
    );
  }

  const url = process.env.REDIS_URL ?? "redis://localhost:6379";
  const { Redis: IORedis } = await import("ioredis");
  const client = new IORedis(url, { lazyConnect: true, enableReadyCheck: true });

  await client.connect().catch((err: unknown) => {
    client.disconnect();
    throw new Error(
      `Redis unavailable: could not connect to ${url} — ${err instanceof Error ? err.message : String(err)}`,
    );
  });

  _client = adaptIoRedis(client);
  return _client;
}

/** For testing only — reset the singleton so tests get a fresh client. */
export function _resetRedisClientForTest(): void {
  _client = null;
}

function adaptIoRedis(client: import("ioredis").Redis): RedisClient {
  return {
    async hset(key, fields) {
      const flat: string[] = [];
      for (const [k, v] of Object.entries(fields)) flat.push(k, v);
      if (flat.length > 0) await client.hset(key, ...flat);
    },
    async hgetall(key) {
      const result = await client.hgetall(key);
      return result && Object.keys(result).length > 0 ? result : null;
    },
    async set(key, value) {
      await client.set(key, value);
    },
    async get(key) {
      return client.get(key);
    },
    async del(...keys) {
      if (keys.length > 0) await client.del(...keys);
    },
    async expire(key, seconds) {
      await client.expire(key, seconds);
    },
    async ping() {
      return client.ping();
    },
    pipeline(): RedisPipeline {
      const pipe = client.pipeline();
      const p: RedisPipeline = {
        hset(key, fields) {
          const flat: string[] = [];
          for (const [k, v] of Object.entries(fields)) flat.push(k, v);
          if (flat.length > 0) pipe.hset(key, ...flat);
          return p;
        },
        set(key, value) {
          pipe.set(key, value);
          return p;
        },
        expire(key, seconds) {
          pipe.expire(key, seconds);
          return p;
        },
        del(...keys) {
          if (keys.length > 0) pipe.del(...keys);
          return p;
        },
        async exec() {
          await pipe.exec();
        },
      };
      return p;
    },
  };
}

function adaptUpstash(client: import("@upstash/redis").Redis): RedisClient {
  return {
    async hset(key, fields) {
      await client.hset(key, fields);
    },
    async hgetall(key) {
      const result = await client.hgetall(key);
      if (!result || Object.keys(result).length === 0) return null;
      const stringified: Record<string, string> = {};
      for (const [k, v] of Object.entries(result)) {
        stringified[k] = typeof v === "string" ? v : JSON.stringify(v);
      }
      return stringified;
    },
    async set(key, value) {
      await client.set(key, value);
    },
    async get(key) {
      const result = await client.get<string>(key);
      return result ?? null;
    },
    async del(...keys) {
      if (keys.length > 0) await client.del(...keys);
    },
    async expire(key, seconds) {
      await client.expire(key, seconds);
    },
    async ping() {
      return client.ping();
    },
    pipeline(): RedisPipeline {
      const pipe = client.pipeline();
      const p: RedisPipeline = {
        hset(key, fields) {
          pipe.hset(key, fields);
          return p;
        },
        set(key, value) {
          pipe.set(key, value);
          return p;
        },
        expire(key, seconds) {
          pipe.expire(key, seconds);
          return p;
        },
        del(...keys) {
          if (keys.length > 0) (pipe as unknown as { del(...k: string[]): void }).del(...keys);
          return p;
        },
        async exec() {
          await pipe.exec();
        },
      };
      return p;
    },
  };
}
