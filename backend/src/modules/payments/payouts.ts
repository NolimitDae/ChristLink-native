import { Logger } from '@nestjs/common';
import type Stripe from 'stripe';
import { Prisma } from '../../../prisma/generated/client';
import type { PrismaService } from '../../prisma/prisma.service';

/** Hosts are paid this long after their event ends (time for "I couldn't get in" refunds and a cancelled event). */
export const PAYOUT_GRACE_HOURS = 24;

const logger = new Logger('HostPayouts');

interface Due {
  host_id: string;
  stripe_account_id: string;
  cents: number;
  ticket_ids: string[];
}

/**
 * Worker job host-payouts: for each host with payouts enabled, pays out the host's share of confirmed tickets for
 * events that ended PAYOUT_GRACE_HOURS ago and haven't been paid yet. Ticket money sits in the host's Stripe balance
 * until then (accounts use a manual payout schedule), so refunds before the payout come back from the host's share.
 * A host whose Stripe balance isn't available yet (card funds take ~2 days) is retried on the next run.
 */
export async function payoutEndedEvents(prisma: PrismaService, stripe: Stripe, now = new Date()) {
  const cutoff = new Date(now.getTime() - PAYOUT_GRACE_HOURS * 3_600_000);
  const due = await prisma.$queryRaw<Due[]>`
    select e.host_id, h.stripe_account_id, sum(t.host_receives_cents)::int as cents, array_agg(t.id) as ticket_ids
    from tickets t
    join events e on e.id = t.event_id
    join host_stripe_accounts h on h.user_id = e.host_id
    where t.status = 'confirmed' and t.payout_id is null and t.host_receives_cents > 0
      and coalesce(e.end_date, e.start_date) < ${cutoff}
      and h.payouts_enabled = true
    group by e.host_id, h.stripe_account_id`;

  const results: { host_id: string; cents: number; status: string }[] = [];
  for (const d of due) {
    if (d.cents <= 0) continue;
    const balance = await stripe.balance.retrieve({}, { stripeAccount: d.stripe_account_id }).catch(() => null);
    const available = balance?.available.find((b) => b.currency === 'usd')?.amount ?? 0;
    if (available < d.cents) {
      results.push({ host_id: d.host_id, cents: d.cents, status: 'waiting_for_funds' });
      continue;
    }
    // Claim the tickets first (only those still unpaid), so an overlapping run can't pay them again
    const payout = await prisma.$transaction(async (tx) => {
      const row = await tx.host_payouts.create({
        data: { user_id: d.host_id, stripe_account_id: d.stripe_account_id, amount_cents: d.cents },
      });
      const claimed = await tx.tickets.updateMany({
        where: { id: { in: d.ticket_ids }, payout_id: null, status: 'confirmed' },
        data: { payout_id: row.id },
      });
      if (claimed.count !== d.ticket_ids.length) throw new Prisma.PrismaClientKnownRequestError('claimed by another run', { code: 'P2034', clientVersion: '' });
      return row;
    }).catch(() => null);
    if (!payout) {
      results.push({ host_id: d.host_id, cents: d.cents, status: 'skipped' });
      continue;
    }
    try {
      const p = await stripe.payouts.create(
        { amount: d.cents, currency: 'usd', metadata: { christlink_payout_id: payout.id, host_id: d.host_id } },
        { stripeAccount: d.stripe_account_id, idempotencyKey: `host-payout-${payout.id}` },
      );
      await prisma.host_payouts.update({ where: { id: payout.id }, data: { stripe_payout_id: p.id, status: p.status } });
      results.push({ host_id: d.host_id, cents: d.cents, status: p.status });
    } catch (e) {
      // Release the tickets so the next run tries again; keep the row as a record of the failure
      const msg = (e as Error).message?.slice(0, 500) ?? 'unknown';
      await prisma.$transaction([
        prisma.tickets.updateMany({ where: { payout_id: payout.id }, data: { payout_id: null } }),
        prisma.host_payouts.update({ where: { id: payout.id }, data: { status: 'failed', error: msg } }),
      ]);
      logger.warn(`Payout to ${d.stripe_account_id} failed: ${msg}`);
      results.push({ host_id: d.host_id, cents: d.cents, status: 'failed' });
    }
  }
  return results;
}
