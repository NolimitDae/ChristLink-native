import { Inject, Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import appConfig from '../../config/app.config';
import { STRIPE } from './stripe.provider';
import { isUuid } from './json-error';
import { dollars, PaymentsService } from './payments.service';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger('Webhook');

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STRIPE) private readonly stripe: Stripe,
    private readonly payments: PaymentsService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Platform secret first, then the Connect secret (server.js handleWebhook). Throws on a bad signature. */
  verify(rawBody: Buffer | undefined, sig: string | undefined): Stripe.Event {
    const { webhook_secret, connect_webhook_secret } = appConfig().stripe;
    try {
      return this.stripe.webhooks.constructEvent(rawBody ?? '', sig ?? '', webhook_secret ?? '');
    } catch (e) {
      if (!connect_webhook_secret) throw e;
      return this.stripe.webhooks.constructEvent(rawBody ?? '', sig ?? '', connect_webhook_secret);
    }
  }

  /** Records the event (idempotency) and handles it. Returns the JSON body for Stripe. */
  async handle(event: Stripe.Event) {
    try {
      await this.prisma.webhook_events.create({ data: { stripe_event_id: event.id, event_type: event.type } });
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') return { received: true, duplicate: true };
      throw e;
    }
    try {
      await this.process(event);
      return { received: true };
    } catch (e) {
      this.logger.error(`Webhook error (${event.type} ${event.id}): ${(e as Error).message}`);
      return { received: true, warning: (e as Error).message };
    }
  }

  private async process(event: Stripe.Event) {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object;
        if (pi.metadata?.type === 'listing_fee') {
          if (isUuid(pi.metadata.event_id)) {
            await this.prisma.events.updateMany({ where: { id: pi.metadata.event_id }, data: { listing_fee_paid: true, listing_payment_id: pi.id } });
          }
          break;
        }
        const rows = await this.payments.confirmPending({ stripe_payment_intent: pi.id });
        this.logger.log(`payment_intent.succeeded ${pi.id}: confirmed ${rows.length}`);
        break;
      }
      case 'payment_intent.payment_failed':
        // Only pending tickets: a late failure event must never undo a confirmed sale
        await this.prisma.tickets.updateMany({ where: { stripe_payment_intent: event.data.object.id, status: 'pending' }, data: { status: 'failed' } });
        break;
      case 'account.updated': {
        const acct = event.data.object;
        if (!(await this.payments.syncAccount(acct))) this.logger.warn(`account.updated: no DB row for ${acct.id}`);
        break;
      }
      case 'charge.refunded': {
        const pi = event.data.object.payment_intent;
        const piId = typeof pi === 'string' ? pi : pi?.id;
        if (!piId) break;
        // Refunds made in the Stripe dashboard: give the seats back and tell the buyer (in-app refunds already did)
        const rows = await this.payments.markRefunded({ stripe_payment_intent: piId });
        await this.prisma.tickets.updateMany({ where: { stripe_payment_intent: piId, status: { notIn: ['refunded', 'confirmed'] } }, data: { status: 'refunded' } });
        for (const t of rows) {
          if (!t.user_id) continue;
          const ev = await this.prisma.events.findUnique({ where: { id: t.event_id }, select: { name: true } });
          await this.notifications.create(
            t.user_id,
            'refund_approved',
            'Refund issued',
            `A refund of ${dollars(t.total_charged_cents)} for "${ev?.name || 'your event'}" has been issued. It may take 5–10 business days to appear.`,
            { ticket_id: t.id, event_id: t.event_id },
          );
        }
        break;
      }
      case 'charge.dispute.created': {
        const d = event.data.object;
        const piId = typeof d.payment_intent === 'string' ? d.payment_intent : d.payment_intent?.id;
        const ticket = piId
          ? await this.prisma.tickets.findUnique({ where: { stripe_payment_intent: piId }, select: { id: true, event_id: true, events: { select: { name: true, host_id: true } } } })
          : null;
        this.logger.warn(`charge.dispute.created ${d.id} pi ${piId} ticket ${ticket?.id ?? 'none'}`);
        if (ticket?.events) {
          await this.notifications.create(
            ticket.events.host_id,
            'payment_dispute',
            `Payment disputed — ${ticket.events.name}`,
            `A buyer disputed a ${dollars(d.amount)} payment. Respond from your Stripe dashboard.`,
            { ticket_id: ticket.id, event_id: ticket.event_id },
          );
        }
        break;
      }
      default:
        if (event.type.startsWith('charge.dispute.')) this.logger.warn(`${event.type} ${(event.data.object as { id: string }).id}`);
    }
  }
}
