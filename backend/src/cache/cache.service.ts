import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { InjectRedis } from '../redis';

/**
 * Short-lived read-through cache in Redis for hot public reads (event lists, verse of the day).
 * Fails open: if Redis is down, the loader runs and the request still succeeds.
 * `bump(ns)` invalidates every key of a namespace at once by moving it to a new version.
 */
@Injectable()
export class CacheService {
  private readonly log = new Logger('Cache');

  constructor(@InjectRedis() private readonly redis: Redis) {}

  private async version(ns: string): Promise<string> {
    try {
      return (await this.redis.get(`cache:${ns}:v`)) ?? '0';
    } catch {
      return 'x';
    }
  }

  async getOrSet<T>(ns: string, key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
    // CACHE_DISABLED=1 (tests) or a zero TTL: always load
    if (ttlSeconds <= 0 || process.env.CACHE_DISABLED === '1') return load();
    const full = `cache:${ns}:${await this.version(ns)}:${key}`;
    try {
      const hit = await this.redis.get(full);
      if (hit !== null) return JSON.parse(hit) as T;
    } catch (e) {
      this.log.warn(`read ${ns} failed: ${(e as Error).message}`);
    }
    const value = await load();
    this.redis.set(full, JSON.stringify(value ?? null), 'EX', ttlSeconds).catch((e) => this.log.warn(`write ${ns} failed: ${(e as Error).message}`));
    return value;
  }

  async bump(ns: string): Promise<void> {
    await this.redis.incr(`cache:${ns}:v`).catch(() => undefined);
  }
}
