import { ModuleRef } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';

export interface RepeatableJob {
  /** Unique; also the BullMQ job scheduler id. */
  name: string;
  /** Cron pattern, UTC. */
  pattern: string;
  /** Get other services with `ref.get(NotificationsService, { strict: false })`. */
  run(prisma: PrismaService, ref: ModuleRef): Promise<unknown>;
}

/**
 * Repeatable jobs run by the worker's 'jobs' queue. Add an entry here; the worker registers it on start and removes
 * schedulers whose entry was deleted.
 */
export const REPEATABLE_JOBS: RepeatableJob[] = [
  {
    // Old rows of the rate_limits table (the Redis throttler counts expire by themselves)
    name: 'rate-limit-cleanup',
    pattern: '15 * * * *',
    run: (prisma) => prisma.$executeRaw`select public.clean_old_rate_limits()`,
  },
];
