import { execSync } from 'child_process';
import Redis from 'ioredis';

/** Brings the e2e database up to the latest migration and clears e2e Redis (rate limits, codes). */
export default async function globalSetup() {
  require('./setup-env');
  execSync('npx prisma migrate deploy', { stdio: 'inherit', env: process.env, cwd: `${__dirname}/..` });
  const redis = new Redis(process.env.REDIS_URL!);
  await redis.flushdb();
  await redis.quit();
}
