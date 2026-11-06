import { Inject, Provider } from '@nestjs/common';
import Redis from 'ioredis';
import appConfig from './config/app.config';

export const REDIS = Symbol('REDIS');

/** `@InjectRedis() private readonly redis: Redis` — the shared ioredis client (OTP codes, rate limits, caches). */
export const InjectRedis = () => Inject(REDIS);

export const redisProvider: Provider = {
  provide: REDIS,
  useFactory: () => new Redis({ ...appConfig().redis, connectTimeout: 5000, maxRetriesPerRequest: 3 }),
};
