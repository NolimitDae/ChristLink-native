import { CacheService } from './cache.service';

/** Minimal in-memory stand-in for the ioredis calls the cache uses. */
function fakeRedis() {
  const store = new Map<string, string>();
  return {
    store,
    get: jest.fn(async (k: string) => store.get(k) ?? null),
    set: jest.fn(async (k: string, v: string) => {
      store.set(k, v);
      return 'OK';
    }),
    incr: jest.fn(async (k: string) => {
      const n = Number(store.get(k) ?? 0) + 1;
      store.set(k, String(n));
      return n;
    }),
  };
}

describe('CacheService', () => {
  const env = process.env.CACHE_DISABLED;
  beforeEach(() => delete process.env.CACHE_DISABLED);
  afterAll(() => (process.env.CACHE_DISABLED = env));

  it('loads once, then serves the cached value until the namespace is bumped', async () => {
    const redis = fakeRedis();
    const cache = new CacheService(redis as never);
    const load = jest.fn(async () => ({ n: Math.random() }));
    const a = await cache.getOrSet('events', 'all', 30, load);
    await new Promise((r) => setImmediate(r));
    const b = await cache.getOrSet('events', 'all', 30, load);
    expect(b).toEqual(a);
    expect(load).toHaveBeenCalledTimes(1);
    await cache.bump('events');
    await cache.getOrSet('events', 'all', 30, load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('fails open when Redis is down', async () => {
    const down = { get: jest.fn().mockRejectedValue(new Error('down')), set: jest.fn().mockRejectedValue(new Error('down')), incr: jest.fn() };
    const cache = new CacheService(down as never);
    await expect(cache.getOrSet('verse', 'x', 60, async () => 'fresh')).resolves.toBe('fresh');
  });

  it('skips the cache when disabled or with a zero TTL', async () => {
    const redis = fakeRedis();
    const cache = new CacheService(redis as never);
    process.env.CACHE_DISABLED = '1';
    await cache.getOrSet('events', 'all', 30, async () => 1);
    delete process.env.CACHE_DISABLED;
    await cache.getOrSet('events', 'all', 0, async () => 1);
    expect(redis.get).not.toHaveBeenCalled();
  });
});
