import { ModuleRef } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../modules/notifications/notifications.service';
import { queuePrayerSummaries } from '../modules/prayers/prayers.service';
import { publishDueEvents } from '../modules/events/event-helpers';
import { payoutEndedEvents } from '../modules/payments/payouts';
import { STRIPE } from '../modules/payments/stripe.provider';
import appConfig from '../config/app.config';
import type Stripe from 'stripe';

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
  {
    // "N people prayed for you today" (was pg_cron queue_prayer_summaries at 20:00 UTC)
    name: 'prayer-daily-summary',
    pattern: '0 20 * * *',
    run: (prisma, ref) => queuePrayerSummaries(prisma, ref.get(NotificationsService, { strict: false })),
  },
  {
    // Drafts whose publish_at has passed go live (was server.js's 60 s setInterval)
    name: 'publish-scheduled-events',
    pattern: '* * * * *',
    run: (prisma, ref) => publishDueEvents(prisma, ref.get(NotificationsService, { strict: false })),
  },
  {
    // Pay hosts their share once their event has ended (payments/payouts.ts); hourly, at :40
    name: 'host-payouts',
    pattern: '40 * * * *',
    run: async (prisma, ref) =>
      appConfig().stripe.secret_key ? payoutEndedEvents(prisma, ref.get<Stripe>(STRIPE, { strict: false })) : 'skipped: no STRIPE_SECRET_KEY',
  },
];
