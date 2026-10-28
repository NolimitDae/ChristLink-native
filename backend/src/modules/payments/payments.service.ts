import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomInt } from 'crypto';
import Stripe from 'stripe';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailJob, QUEUE_EMAIL } from '../../queues/queues';
import appConfig from '../../config/app.config';
import type { AuthUser } from '../../common/auth.decorators';
import type { Prisma } from '../../../prisma/generated/client';
import { STRIPE } from './stripe.provider';
import { calcAmounts, couponDiscountCents, HOST_LISTING_FEE, listingDiscountCents } from './fees';
import { escapeHtml, isUuid, JsonError, stripeError } from './json-error';

const SALE_SELECT = {
  id: true,
  code: true,
  quantity: true,
  ticket_type_id: true,
  event_id: true,
  total_charged_cents: true,
  user_id: true,
  buyer_email: true,
} as const;

export const dollars = (cents: number | null | undefined) => `$${((cents || 0) / 100).toFixed(2)}`;
const plural = (n: number) => (n !== 1 ? 's' : '');

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger('Payments');

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STRIPE) private readonly stripe: Stripe,
    private readonly notifications: NotificationsService,
    @InjectQueue(QUEUE_EMAIL) private readonly emailQueue: Queue<EmailJob>,
  ) {}

  // ── Fees ──────────────────────────────────────────────────
  priceBreakdown(q: { price?: string; qty?: string; absorb?: string }) {
    if (!q.price) throw new BadRequestException('Price required.');
    const price = Number(q.price);
    const qty = Number(q.qty ?? 1);
    if (!Number.isInteger(price) || price < 0) throw new BadRequestException('Price required.');
    if (!Number.isInteger(qty) || qty < 1) throw new BadRequestException('Quantity must be between 1 and 20.');
    return calcAmounts(price, qty, (q.absorb ?? 'true') === 'true');
  }

  async taxEstimate(amountCents: unknown) {
    if (!amountCents) throw new BadRequestException('Amount required.');
    try {
      const calc = await this.stripe.tax.calculations.create({
        currency: 'usd',
        line_items: [{ amount: Number(amountCents), reference: 'ticket' }],
        customer_details: { address_source: 'shipping', address: { country: 'US' }, taxability_override: 'none' },
      });
      return { taxAmountCents: calc.tax_amount_exclusive, totalCents: calc.amount_total, calculationId: calc.id };
    } catch {
      return { taxAmountCents: 0, totalCents: amountCents, calculationId: null };
    }
  }

  // ── Checkout ──────────────────────────────────────────────
  async createPaymentIntent(user: AuthUser, body: Record<string, any>) {
    const { eventId, ticketTypeId, qty = 1, buyerEmail, couponCode } = body ?? {};
    const parsedQty = parseInt(String(qty), 10);
    if (!eventId || !ticketTypeId) throw new BadRequestException('Event ID and ticket type required.');
    if (!parsedQty || parsedQty < 1 || parsedQty > 20) throw new BadRequestException('Quantity must be between 1 and 20.');

    const ev = isUuid(eventId)
      ? await this.prisma.events.findUnique({
          where: { id: eventId },
          select: { id: true, name: true, status: true, is_paid: true, absorb_stripe_fee: true, host_id: true, end_date: true, sales_cutoff: true },
        })
      : null;
    if (!ev) throw new NotFoundException('Event not found. It may have been removed or unpublished.');
    if (ev.status !== 'published') throw new BadRequestException('This event is not currently available for ticket purchases.');
    const cutoff = ev.sales_cutoff || ev.end_date;
    if (cutoff && new Date() > cutoff) throw new BadRequestException('Ticket sales for this event are now closed.');
    if (!ev.is_paid) throw new BadRequestException('This is a free event — use RSVP instead.');

    const acct = await this.prisma.host_stripe_accounts.findUnique({ where: { user_id: ev.host_id } });
    if (!acct?.stripe_account_id) {
      throw new BadRequestException('The host has not set up payments yet. Please contact the event organiser.');
    }
    if (!acct.charges_enabled) {
      throw new BadRequestException(
        "The host's payment account is still being verified by Stripe. Please try again later or contact the event organiser.",
      );
    }

    const tt = isUuid(ticketTypeId)
      ? await this.prisma.ticket_types.findFirst({ where: { id: ticketTypeId, event_id: eventId } })
      : null;
    if (!tt) throw new NotFoundException('Ticket type not found for this event.');
    const remaining = tt.quantity != null ? tt.quantity - (tt.sold || 0) : Infinity;
    if (parsedQty > remaining) throw new BadRequestException(`Only ${remaining} ticket${plural(remaining)} remaining.`);

    let adjustedPriceCents = tt.price_cents;
    let couponId: string | null = null;
    let discountCents = 0;
    if (typeof couponCode === 'string' && couponCode.trim()) {
      const coupon = await this.prisma.coupons.findFirst({
        where: { event_id: eventId, code: couponCode.trim().toUpperCase(), active: true },
      });
      if (coupon && !(coupon.expires_at && coupon.expires_at < new Date()) && !(coupon.max_uses && coupon.uses >= coupon.max_uses)) {
        couponId = coupon.id;
        discountCents = couponDiscountCents(coupon.discount_type, coupon.discount_value, tt.price_cents);
        adjustedPriceCents = Math.max(0, tt.price_cents - discountCents);
      }
    }
    const amounts = calcAmounts(adjustedPriceCents, parsedQty, ev.absorb_stripe_fee !== false);
    const email = (typeof buyerEmail === 'string' && buyerEmail.trim()) || user.email;
    const ticketCode = Array.from({ length: 8 }, () => '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'[randomInt(36)]).join('');
    const ticketRow = {
      event_id: eventId,
      ticket_type_id: ticketTypeId,
      user_id: user.id,
      quantity: parsedQty,
      unit_price_cents: tt.price_cents,
      buyer_email: email,
      code: ticketCode,
      coupon_id: couponId,
      discount_cents: discountCents || 0,
    };

    try {
      // Free path: a coupon discounted it to $0, skip Stripe
      if (amounts.chargeAmount === 0) {
        const inserted = await this.prisma.tickets.create({
          data: { ...ticketRow, total_charged_cents: 0, platform_fee_cents: 0, stripe_fee_cents: 0, host_receives_cents: 0, status: 'confirmed', confirmed_at: new Date() },
          select: SALE_SELECT,
        });
        if (couponId) await this.prisma.coupons.update({ where: { id: couponId }, data: { uses: { increment: 1 } } });
        await this.incrementSold(ticketTypeId, parsedQty);
        void this.afterSale(inserted);
        return { free: true, breakdown: amounts, ticketCode: inserted.code || ticketCode };
      }

      // server.js keyed on user/event/type/qty only, which blocked buying the same tickets again for 24 h.
      // Adding the amount and the buyer's finished tickets keeps double taps on one PaymentIntent but lets a
      // second purchase (or a changed coupon) get a new one.
      const finished = await this.prisma.tickets.count({ where: { user_id: user.id, ticket_type_id: ticketTypeId, status: { not: 'pending' } } });
      const idempotencyKey = `pi-${user.id}-${eventId}-${ticketTypeId}-${parsedQty}-${amounts.chargeAmount}-${finished}`;
      const intent = await this.stripe.paymentIntents.create(
        {
          amount: amounts.chargeAmount,
          currency: 'usd',
          payment_method_types: ['card'],
          receipt_email: email,
          description: `${parsedQty}x ${tt.name} — ${ev.name}`,
          metadata: {
            event_id: eventId,
            ticket_type_id: ticketTypeId,
            buyer_id: user.id,
            qty: String(parsedQty),
            platform_fee: String(amounts.platformFee),
          },
          transfer_data: { destination: acct.stripe_account_id },
          application_fee_amount: amounts.platformFee,
        },
        { idempotencyKey },
      );

      // A double tap returns the same PaymentIntent: reuse its pending ticket instead of inserting a second one
      const existing = await this.prisma.tickets.findUnique({ where: { stripe_payment_intent: intent.id }, select: { code: true } });
      let code = existing?.code;
      if (!existing) {
        const inserted = await this.prisma.tickets.upsert({
          where: { stripe_payment_intent: intent.id },
          create: {
            ...ticketRow,
            total_charged_cents: amounts.chargeAmount,
            platform_fee_cents: amounts.platformFee,
            stripe_fee_cents: amounts.stripeFee,
            host_receives_cents: amounts.hostReceives,
            stripe_payment_intent: intent.id,
            stripe_idempotency_key: idempotencyKey,
            status: 'pending',
          },
          update: {},
          select: { code: true },
        });
        code = inserted.code;
        if (couponId) await this.prisma.coupons.update({ where: { id: couponId }, data: { uses: { increment: 1 } } });
      }
      return { clientSecret: intent.client_secret, breakdown: amounts, intentId: intent.id, ticketCode: code || ticketCode };
    } catch (e) {
      const err = e as { type?: string; message?: string };
      if (err?.type?.startsWith('Stripe')) {
        this.logger.error(`[payment-intent] ${err.message}`);
        throw new JsonError(400, {
          error: err.type === 'StripeInvalidRequestError' ? 'Payment setup failed — please try again or contact support.' : err.message,
        });
      }
      throw e;
    }
  }

  async confirmByIntent(user: AuthUser, paymentIntentId: unknown) {
    if (!paymentIntentId || typeof paymentIntentId !== 'string') throw new BadRequestException('paymentIntentId required.');
    const intent = await this.stripe.paymentIntents.retrieve(paymentIntentId).catch(stripeError);
    if (intent.status !== 'succeeded') throw new BadRequestException(`Payment status is ${intent.status}, not succeeded.`);
    const rows = await this.confirmPending({ stripe_payment_intent: paymentIntentId, user_id: user.id });
    return {
      confirmed: true,
      tickets: rows.map(({ id, code, quantity, ticket_type_id, event_id, total_charged_cents }) => ({
        id,
        code,
        quantity,
        ticket_type_id,
        event_id,
        total_charged_cents,
      })),
    };
  }

  /**
   * pending → confirmed. The conditional update makes the webhook and confirm-by-intent race-safe: only the caller
   * that flips the row counts the sale and sends the notifications.
   */
  async confirmPending(where: Prisma.ticketsWhereInput) {
    const rows = await this.prisma.tickets.updateManyAndReturn({
      where: { ...where, status: 'pending' },
      data: { status: 'confirmed', confirmed_at: new Date() },
      select: SALE_SELECT,
    });
    if (rows.length > 0 && rows[0].ticket_type_id) {
      await this.incrementSold(rows[0].ticket_type_id, rows[0].quantity || 1);
      void this.afterSale(rows[0]);
    }
    return rows;
  }

  /** confirmed → refunded, giving the seats back. Returns only rows this call changed. */
  async markRefunded(where: Prisma.ticketsWhereInput) {
    const rows = await this.prisma.tickets.updateManyAndReturn({
      where: { ...where, status: 'confirmed' },
      data: { status: 'refunded' },
      select: SALE_SELECT,
    });
    for (const t of rows) await this.incrementSold(t.ticket_type_id, -(t.quantity || 1));
    return rows;
  }

  incrementSold(ticketTypeId: string, qty: number) {
    return this.prisma.$executeRaw`select increment_tickets_sold(${ticketTypeId}::uuid, ${qty}::int)`;
  }

  /** Host gets the sale (server.js notifyHostOfSale); the buyer gets 'ticket_confirmed'. Never throws. */
  async afterSale(ticket: { id: string; event_id: string; user_id: string | null; quantity: number; total_charged_cents: number; buyer_email: string | null }) {
    try {
      const [ev, buyer] = await Promise.all([
        this.prisma.events.findUnique({ where: { id: ticket.event_id }, select: { name: true, host_id: true } }),
        ticket.user_id ? this.prisma.profiles.findUnique({ where: { id: ticket.user_id }, select: { full_name: true, email: true } }) : null,
      ]);
      if (!ev) return;
      const qty = ticket.quantity || 1;
      if (ticket.user_id) {
        await this.notifications.create(
          ticket.user_id,
          'ticket_confirmed',
          'Ticket confirmed',
          `Your ${qty} ticket${plural(qty)} for "${ev.name}" ${qty > 1 ? 'are' : 'is'} confirmed.`,
          { event_id: ticket.event_id, ticket_id: ticket.id },
        );
      }
      const host = await this.prisma.profiles.findUnique({ where: { id: ev.host_id }, select: { email: true } });
      if (!host) return;
      const amount = ticket.total_charged_cents ? dollars(ticket.total_charged_cents) : 'Free';
      const buyerName = buyer?.full_name || ticket.buyer_email || 'A guest';
      await this.notifications.create(
        ev.host_id,
        'ticket_sale',
        `New ticket sale — ${ev.name}`,
        `${buyerName} purchased ${qty} ticket${qty > 1 ? 's' : ''} (${amount}).`,
        { event_id: ticket.event_id },
      );
      await this.email(
        host.email,
        `New ticket sale for "${ev.name}"`,
        `<h2 style="margin:0 0 16px">New Ticket Sale</h2>
        <p style="margin:0 0 10px;font-size:15px"><strong>${escapeHtml(buyerName)}</strong> just purchased
          <strong>${qty} ticket${qty > 1 ? 's' : ''}</strong> to <strong>${escapeHtml(ev.name)}</strong>.</p>
        <p style="font-size:15px;margin:0 0 10px">Amount: <strong>${amount}</strong></p>
        <p style="font-size:13px;color:#888;margin:24px 0 0">View your sales in the ChristLink host dashboard.</p>`,
        `${buyerName} just purchased ${qty} ticket${qty > 1 ? 's' : ''} to ${ev.name}. Amount: ${amount}.`,
      );
    } catch (e) {
      this.logger.error(`[afterSale] ${(e as Error).message}`);
    }
  }

  /** Queues an email (server.js sendEmail). Missing address → skipped. */
  async email(to: string | null | undefined, subject: string, htmlBody: string, text: string) {
    if (!to) return;
    const html = `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">${htmlBody}</div>`;
    await this.emailQueue.add('email', { to, subject, html, text }, { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 1000 });
  }

  // ── Stripe Connect ────────────────────────────────────────
  async connectOnboard(user: AuthUser, host: string | undefined) {
    try {
      const existing = await this.prisma.host_stripe_accounts.findUnique({ where: { user_id: user.id } });
      let accountId = existing?.stripe_account_id;
      if (!accountId) {
        const account = await this.stripe.accounts.create({
          type: 'express',
          email: user.email,
          capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
          metadata: { christlink_user_id: user.id },
        });
        accountId = account.id;
        await this.prisma.host_stripe_accounts.create({
          data: { user_id: user.id, stripe_account_id: accountId, onboarding_complete: false, payouts_enabled: false, charges_enabled: false },
        });
      } else if (existing?.payouts_enabled) {
        try {
          const loginLink = await this.stripe.accounts.createLoginLink(accountId);
          return { url: loginLink.url, accountId, alreadyOnboarded: true };
        } catch {
          // fall through to re-onboard
        }
      }
      const appUrl = (appConfig().app.app_url || `https://${host}`).replace(/\/$/, '');
      const link = await this.stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${appUrl}/?reauth=1`,
        return_url: `${appUrl}/?connected=1`,
        type: 'account_onboarding',
      });
      return { url: link.url, accountId };
    } catch (e) {
      const msg = (e as Error)?.message ?? '';
      if (msg.toLowerCase().includes('platform profile')) {
        throw new JsonError(400, {
          error:
            'Stripe Connect is not fully configured yet. The platform owner must complete the Connect platform profile in the Stripe Dashboard before hosts can set up payouts.',
          platformSetup: true,
        });
      }
      stripeError(e);
    }
  }

  async connectSync(user: AuthUser) {
    const row = await this.prisma.host_stripe_accounts.findUnique({ where: { user_id: user.id } });
    if (!row?.stripe_account_id) throw new NotFoundException('No connected account found.');
    const account = await this.stripe.accounts.retrieve(row.stripe_account_id).catch(stripeError);
    await this.syncAccount(account);
    return {
      accountId: row.stripe_account_id,
      onboardingComplete: account.details_submitted,
      payoutsEnabled: account.payouts_enabled,
      chargesEnabled: account.charges_enabled,
      requirements: account.requirements,
    };
  }

  /** Shared by connect-sync and the account.updated webhook. Returns false when no row has this account. */
  async syncAccount(account: Stripe.Account) {
    const row = await this.prisma.host_stripe_accounts.findUnique({ where: { stripe_account_id: account.id } });
    if (!row) return false;
    await this.prisma.host_stripe_accounts.update({
      where: { stripe_account_id: account.id },
      data: {
        onboarding_complete: account.details_submitted,
        payouts_enabled: account.payouts_enabled,
        charges_enabled: account.charges_enabled,
        updated_at: new Date(),
      },
    });
    if (account.payouts_enabled) await this.prisma.profiles.updateMany({ where: { id: row.user_id }, data: { role: 'host' } });
    return true;
  }

  async connectDisconnect(user: AuthUser) {
    const { count } = await this.prisma.host_stripe_accounts.deleteMany({ where: { user_id: user.id } });
    if (!count) throw new NotFoundException('No connected Stripe account found.');
    return { success: true };
  }

  // ── Listing fee ───────────────────────────────────────────
  private async findPromo(code: string) {
    return this.prisma.listing_promo_codes.findFirst({ where: { code: code.toUpperCase().trim(), active: true } });
  }

  async validateListingPromo(code: unknown) {
    if (!code || typeof code !== 'string') throw new BadRequestException('Code required.');
    const promo = await this.findPromo(code);
    if (!promo) throw new NotFoundException('Invalid or expired promo code.');
    if (promo.expires_at && new Date() > promo.expires_at) throw new BadRequestException('This promo code has expired.');
    if (promo.max_uses !== null && promo.uses_count >= promo.max_uses) {
      throw new BadRequestException('This promo code has reached its usage limit.');
    }
    const discountValue = Number(promo.discount_value);
    const discountCents = listingDiscountCents(promo.discount_type, discountValue);
    return {
      valid: true,
      promo_id: promo.id,
      discount_type: promo.discount_type,
      discount_value: discountValue,
      discount_cents: discountCents,
      final_cents: Math.max(0, HOST_LISTING_FEE - discountCents),
    };
  }

  async chargeListingFee(user: AuthUser, body: Record<string, any>) {
    const { paymentMethodId, eventId, hostEmail, promoCode } = body ?? {};
    if (!eventId) throw new BadRequestException('Event ID required.');
    if (!paymentMethodId || typeof paymentMethodId !== 'string') throw new BadRequestException('Payment method required.');
    const ev = isUuid(eventId)
      ? await this.prisma.events.findFirst({ where: { id: eventId, host_id: user.id }, select: { id: true, name: true, listing_fee_paid: true } })
      : null;
    if (!ev) throw new NotFoundException('Event not found or not yours.');
    if (ev.listing_fee_paid) throw new BadRequestException('Listing fee already paid.');

    let chargeAmount = HOST_LISTING_FEE;
    let appliedPromoId: string | null = null;
    if (typeof promoCode === 'string' && promoCode.trim()) {
      const promo = await this.findPromo(promoCode);
      if (promo && !(promo.expires_at && new Date() > promo.expires_at) && (promo.max_uses === null || promo.uses_count < promo.max_uses)) {
        chargeAmount = Math.max(0, HOST_LISTING_FEE - listingDiscountCents(promo.discount_type, Number(promo.discount_value)));
        appliedPromoId = promo.id;
      }
    }
    if (paymentMethodId === '__promo_free__' && chargeAmount > 0) {
      throw new JsonError(400, { error: 'Promo code could not be applied. Please re-enter your card details and try again.', resetCard: true });
    }

    const markPaid = async (paymentId: string) => {
      await this.prisma.events.update({ where: { id: eventId }, data: { listing_fee_paid: true, listing_payment_id: paymentId } });
      if (appliedPromoId) await this.prisma.listing_promo_codes.update({ where: { id: appliedPromoId }, data: { uses_count: { increment: 1 } } });
    };
    if (chargeAmount === 0) {
      await markPaid('promo_free');
      return { success: true, intentId: 'promo_free' };
    }

    let intent: Stripe.PaymentIntent;
    try {
      intent = await this.stripe.paymentIntents.create(
        {
          amount: chargeAmount,
          currency: 'usd',
          payment_method_types: ['card'],
          payment_method: paymentMethodId,
          confirm: true,
          receipt_email: hostEmail || user.email || undefined,
          description: `Christ Link listing fee — ${ev.name}`,
          metadata: { type: 'listing_fee', event_id: eventId, host_id: user.id, promo_id: appliedPromoId || '' },
          return_url: `${appConfig().app.app_url}/?listing_success=1`,
        },
        { idempotencyKey: `listing-fee-${eventId}-${paymentMethodId.slice(-12)}` },
      );
    } catch (e) {
      const err = e as { raw?: { code?: string }; message?: string; type?: string };
      if (!err?.type?.startsWith('Stripe')) throw e;
      this.logger.error(`[listing-fee] ${err.raw?.code} ${err.message} event ${eventId}`);
      const msg =
        err.raw?.code === 'payment_method_unexpected_state' || (err.message || '').toLowerCase().includes('previously used')
          ? 'Your card could not be reused. Please re-enter your card details and try again.'
          : err.message;
      throw new JsonError(400, { error: msg, resetCard: true });
    }
    if (intent.status === 'succeeded') {
      await markPaid(intent.id);
      return { success: true, intentId: intent.id };
    }
    throw new JsonError(400, { success: false, status: intent.status, error: `Payment status: ${intent.status}. Please try again.` });
  }
}
