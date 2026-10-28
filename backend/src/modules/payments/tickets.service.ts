import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { STRIPE } from './stripe.provider';
import { escapeHtml, isUuid, JsonError, stripeError } from './json-error';
import { dollars, PaymentsService } from './payments.service';

const VERIFY_INCLUDE = {
  events: { select: { name: true, start_date: true, city: true, host_id: true } },
  ticket_types: { select: { name: true } },
} as const;

/** server.js's confirmation code: last 8 alphanumerics of the PaymentIntent (or ticket id), upper case. */
export const piShortCode = (t: { stripe_payment_intent: string | null; id: string }) =>
  (t.stripe_payment_intent || t.id).replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase();

@Injectable()
export class TicketsService {
  private readonly logger = new Logger('Tickets');

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STRIPE) private readonly stripe: Stripe,
    private readonly notifications: NotificationsService,
    private readonly payments: PaymentsService,
  ) {}

  async myTickets(userId: string) {
    const rows = await this.prisma.tickets.findMany({ where: { user_id: userId }, orderBy: { created_at: 'desc' } });
    if (rows.length === 0) return { tickets: [] };
    const eventIds = [...new Set(rows.map((t) => t.event_id))];
    const typeIds = [...new Set(rows.map((t) => t.ticket_type_id))];
    const [events, types, checkins] = await Promise.all([
      this.prisma.events.findMany({ where: { id: { in: eventIds } }, select: { id: true, name: true, start_date: true, city: true, cover_url: true, host_id: true } }),
      this.prisma.ticket_types.findMany({ where: { id: { in: typeIds } }, select: { id: true, name: true } }),
      this.prisma.ticket_checkins.findMany({ where: { ticket_id: { in: rows.map((t) => t.id) } }, select: { ticket_id: true, checked_in_at: true } }),
    ]);
    const ev = new Map(events.map((e) => [e.id, e]));
    const tt = new Map(types.map((t) => [t.id, t]));
    const ci = new Map(checkins.map((c) => [c.ticket_id, c.checked_in_at]));
    return {
      tickets: rows.map((t) => ({
        ...t,
        event_name: ev.get(t.event_id)?.name,
        event_start_date: ev.get(t.event_id)?.start_date,
        event_city: ev.get(t.event_id)?.city,
        event_cover_url: ev.get(t.event_id)?.cover_url,
        event_host_id: ev.get(t.event_id)?.host_id,
        ticket_type_name: tt.get(t.ticket_type_id)?.name,
        checked_in: ci.has(t.id),
        checked_in_at: ci.get(t.id) || null,
      })),
    };
  }

  // ── Check-in ──────────────────────────────────────────────
  async verify(userId: string, body: Record<string, any>) {
    const { ticketId, code, eventId } = body ?? {};
    if (!ticketId && !code) throw new JsonError(400, { valid: false, error: 'Ticket ID or code required.' });
    const notHost = () => new JsonError(403, { valid: false, error: 'Only the event host can verify tickets.' });
    try {
      if (eventId) {
        const ev = isUuid(eventId) ? await this.prisma.events.findUnique({ where: { id: eventId }, select: { host_id: true } }) : null;
        if (!ev || ev.host_id !== userId) throw notHost();
      }

      // By the ticket's own code first (needs the event)
      if (!ticketId && isUuid(eventId) && typeof code === 'string') {
        const byCode = await this.prisma.tickets.findFirst({
          where: { status: 'confirmed', event_id: eventId, code: { equals: code, mode: 'insensitive' } },
          include: VERIFY_INCLUDE,
        });
        if (byCode) {
          const ticket = { ...this.publicTicket(byCode), code: byCode.code, event_name: byCode.events?.name };
          const already = await this.checkIn(byCode, userId);
          if (already) {
            return { valid: false, already_checked_in: true, message: `Already checked in at ${already.toLocaleTimeString()}`, ticket };
          }
          return { valid: true, message: this.checkedInMessage(byCode.quantity), ticket: { ...ticket, ticket_type_name: byCode.ticket_types?.name } };
        }
      }

      // By ticket id (QR) or the PaymentIntent suffix
      let ticket = null;
      if (ticketId ? isUuid(ticketId) : typeof code === 'string' && code) {
        const matches = await this.prisma.tickets.findMany({
          where: {
            status: 'confirmed',
            ...(ticketId ? { id: ticketId } : { stripe_payment_intent: { endsWith: code, mode: 'insensitive' } }),
            ...(eventId ? { event_id: eventId } : {}),
          },
          include: VERIFY_INCLUDE,
          take: 2,
        });
        ticket = matches.length === 1 ? matches[0] : null; // .single(): ambiguous suffix = not found
      }
      if (!ticket) return { valid: false, error: 'Ticket not found or not confirmed for this event.' };
      // server.js skipped the host check when no eventId was sent; anyone signed in could check tickets in
      if (ticket.events?.host_id !== userId) throw notHost();

      const out = { ...this.publicTicket(ticket), code: piShortCode(ticket), event_name: ticket.events?.name };
      const already = await this.checkIn(ticket, userId);
      if (already) return { valid: false, error: `Already checked in at ${already.toLocaleTimeString()}`, ticket: out };
      return {
        valid: true,
        message: this.checkedInMessage(ticket.quantity),
        ticket: { ...out, event_start_date: ticket.events?.start_date, ticket_type_name: ticket.ticket_types?.name },
      };
    } catch (e) {
      if (e instanceof JsonError) throw e;
      this.logger.error(`Verify error: ${(e as Error).message}`);
      throw new JsonError(500, { valid: false, error: 'Verification failed. Try again.' });
    }
  }

  private checkedInMessage(qty: number) {
    return `${qty} ticket${qty !== 1 ? 's' : ''} checked in successfully.`;
  }

  /** Embedded event without host_id, like server.js's events(name,start_date,city). */
  private publicTicket<T extends { events: { host_id: string } | null }>(t: T) {
    const { host_id: _host, ...events } = t.events ?? ({} as { host_id: string });
    return { ...t, events: t.events ? events : null };
  }

  /** Records the check-in. Returns the earlier check-in time if the ticket was already in (race-safe). */
  private async checkIn(ticket: { id: string; event_id: string }, userId: string): Promise<Date | null> {
    const existing = await this.prisma.ticket_checkins.findUnique({ where: { ticket_id: ticket.id } });
    if (existing) return existing.checked_in_at;
    try {
      await this.prisma.ticket_checkins.create({ data: { ticket_id: ticket.id, event_id: ticket.event_id, checked_in_by: userId } });
      return null;
    } catch (e) {
      if ((e as { code?: string }).code !== 'P2002') throw e;
      return (await this.prisma.ticket_checkins.findUnique({ where: { ticket_id: ticket.id } }))?.checked_in_at ?? new Date();
    }
  }

  async attendance(userId: string, eventId: string) {
    const ev = isUuid(eventId) ? await this.prisma.events.findUnique({ where: { id: eventId }, select: { host_id: true, max_capacity: true } }) : null;
    if (!ev || ev.host_id !== userId) throw new ForbiddenException('Not your event.');
    const [total, checkedIn] = await Promise.all([
      this.prisma.tickets.count({ where: { event_id: eventId, status: 'confirmed' } }),
      this.prisma.ticket_checkins.count({ where: { event_id: eventId } }),
    ]);
    return { total, checked_in: checkedIn, capacity: ev.max_capacity };
  }

  // ── Refunds ───────────────────────────────────────────────
  /** Stripe refund of the ticket's charge. The idempotency key means a host refund and an approval can't both pay out. */
  private async refundCharge(ticketId: string, paymentIntentId: string, noCharge: string) {
    const intent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
    if (!intent.latest_charge) throw new BadRequestException(noCharge);
    const charge = typeof intent.latest_charge === 'string' ? intent.latest_charge : intent.latest_charge.id;
    return this.stripe.refunds.create({ charge }, { idempotencyKey: `refund-${ticketId}` });
  }

  async hostRefund(userId: string, ticketId: string) {
    const ticket = isUuid(ticketId) ? await this.prisma.tickets.findUnique({ where: { id: ticketId } }) : null;
    if (!ticket) throw new NotFoundException('Ticket not found.');
    if (ticket.status !== 'confirmed') throw new BadRequestException('Only confirmed tickets can be refunded.');
    const ev = await this.prisma.events.findUnique({ where: { id: ticket.event_id }, select: { host_id: true, name: true } });
    if (!ev || ev.host_id !== userId) throw new ForbiddenException('Only the event host can issue refunds.');
    if (!ticket.stripe_payment_intent) throw new BadRequestException('No payment on record for this ticket.');

    const refund = await this.refundCharge(ticket.id, ticket.stripe_payment_intent, 'No charge found for this payment.').catch(stripeError);
    const [updated] = await this.payments.markRefunded({ id: ticket.id });
    // Only notify if this call flipped the ticket (the charge.refunded webhook may have done it already)
    if (updated?.user_id) {
      const amt = updated.total_charged_cents ? dollars(updated.total_charged_cents) : 'your payment';
      const name = ev.name || 'your event';
      await this.notifications.create(
        updated.user_id,
        'refund_approved',
        'Refund issued',
        `The host has issued a refund of ${amt} for "${name}". It may take 5–10 business days to appear.`,
        { event_id: ticket.event_id },
      );
      const attendee = await this.prisma.profiles.findUnique({ where: { id: updated.user_id }, select: { email: true } });
      await this.payments.email(
        attendee?.email || updated.buyer_email,
        `Refund issued for "${ev.name}"`,
        `<h2 style="margin:0 0 16px">Refund Issued</h2>
        <p style="font-size:15px;margin:0 0 10px">The host has issued a refund of <strong>${amt}</strong> for <strong>"${escapeHtml(ev.name)}"</strong>.</p>
        <p style="font-size:14px;color:#555;margin:0 0 10px">It may take 5–10 business days to appear on your statement.</p>`,
        `The host has issued a refund of ${amt} for "${ev.name}". It may take 5–10 business days to appear on your statement.`,
      );
    }
    return { success: true, refundId: refund.id };
  }

  async requestRefund(userId: string, ticketId: string, reason: unknown) {
    const ticket = isUuid(ticketId) ? await this.prisma.tickets.findFirst({ where: { id: ticketId, user_id: userId } }) : null;
    if (!ticket) throw new NotFoundException('Ticket not found.');
    if (ticket.status !== 'confirmed') throw new BadRequestException('Only confirmed tickets can be refunded.');
    if ((ticket.total_charged_cents || 0) === 0) throw new BadRequestException('Free tickets cannot be refunded.');
    const ev = await this.prisma.events.findUnique({ where: { id: ticket.event_id }, select: { id: true, name: true, host_id: true } });
    if (!ev) throw new NotFoundException('Event not found.');
    const [requester, host] = await Promise.all([
      this.prisma.profiles.findUnique({ where: { id: userId }, select: { full_name: true } }),
      this.prisma.profiles.findUnique({ where: { id: ev.host_id }, select: { email: true } }),
    ]);

    const why = typeof reason === 'string' && reason.trim() ? reason.trim().slice(0, 2000) : null;
    const fields = { event_id: ev.id, requester_id: userId, host_id: ev.host_id, reason: why, status: 'pending', updated_at: new Date() };
    const request = await this.prisma.refund_requests.upsert({
      where: { ticket_id: ticketId },
      create: { ticket_id: ticketId, ...fields },
      update: fields,
    });

    const requesterName = requester?.full_name || ticket.buyer_email || 'A guest';
    const amount = dollars(ticket.total_charged_cents);
    await this.notifications.create(
      ev.host_id,
      'refund_request',
      `Refund request — ${ev.name}`,
      `${requesterName} requested a refund (${amount}).${why ? ' Reason: ' + why : ''}`,
      { refund_request_id: request.id, ticket_id: ticketId, event_id: ev.id },
    );
    const code = ticket.code || ticketId.slice(0, 8).toUpperCase();
    await this.payments.email(
      host?.email,
      `Refund request for "${ev.name}"`,
      `<h2 style="color:#C9A84C">Refund Request</h2>
      <p><strong>${escapeHtml(requesterName)}</strong> has requested a refund for their ticket to <strong>${escapeHtml(ev.name)}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:8px 0;color:#555">Amount:</td><td style="padding:8px 0;font-weight:600">${amount}</td></tr>
        <tr><td style="padding:8px 0;color:#555">Ticket code:</td><td style="padding:8px 0;font-family:monospace">${escapeHtml(code)}</td></tr>
        ${why ? `<tr><td style="padding:8px 0;color:#555;vertical-align:top">Reason:</td><td style="padding:8px 0">${escapeHtml(why)}</td></tr>` : ''}
      </table>
      <p>Log in to ChristLink to approve or deny this request from your event's Sales section.</p>
      <p style="color:#888;font-size:12px">ChristLink · Faith Events Platform</p>`,
      `${requesterName} has requested a refund (${amount}) for their ticket to ${ev.name}. Ticket code: ${code}.${why ? ' Reason: ' + why : ''}`,
    );
    return { success: true, requestId: request.id };
  }

  async refundRequests(userId: string, eventId?: string) {
    if (eventId && !isUuid(eventId)) return { requests: [] };
    const rows = await this.prisma.refund_requests.findMany({
      where: { host_id: userId, ...(eventId ? { event_id: eventId } : {}) },
      include: {
        tickets: { select: { id: true, quantity: true, total_charged_cents: true, code: true, buyer_email: true } },
        events: { select: { id: true, name: true } },
      },
      orderBy: { created_at: 'desc' },
      take: 50,
    });
    const ids = [...new Set(rows.map((r) => r.requester_id).filter(Boolean))];
    const people = await this.prisma.profiles.findMany({ where: { id: { in: ids } }, select: { id: true, full_name: true, avatar_url: true, avatar_color: true } });
    const byId = new Map(people.map(({ id, ...p }) => [id, p]));
    return { requests: rows.map((r) => ({ ...r, profiles: byId.get(r.requester_id) ?? null })) };
  }

  private findOwnRequest(userId: string, id: string) {
    return isUuid(id)
      ? this.prisma.refund_requests.findFirst({
          where: { id, host_id: userId },
          include: {
            tickets: { select: { id: true, stripe_payment_intent: true, quantity: true, ticket_type_id: true, user_id: true, total_charged_cents: true, buyer_email: true } },
            events: { select: { name: true } },
          },
        })
      : null;
  }

  async approve(userId: string, id: string) {
    const request = await this.findOwnRequest(userId, id);
    if (!request) throw new NotFoundException('Request not found.');
    if (request.status !== 'pending') throw new BadRequestException('Request already resolved.');
    const ticket = request.tickets;
    if (!ticket?.stripe_payment_intent) throw new BadRequestException('No payment on record.');
    const refund = await this.refundCharge(ticket.id, ticket.stripe_payment_intent, 'No charge found.').catch(stripeError);

    await this.payments.markRefunded({ id: ticket.id });
    // schema gap: refund_requests has no resolved_at; updated_at records the decision time
    await this.prisma.refund_requests.update({ where: { id: request.id }, data: { status: 'approved', updated_at: new Date() } });
    const amt = dollars(ticket.total_charged_cents);
    if (ticket.user_id) {
      await this.notifications.create(
        ticket.user_id,
        'refund_approved',
        'Refund approved',
        `Your refund of ${amt} has been issued. It may take 5–10 business days to appear.`,
        { ticket_id: ticket.id, event_id: request.event_id },
      );
    }
    const evName = request.events?.name ?? '';
    const attendee = ticket.user_id ? await this.prisma.profiles.findUnique({ where: { id: ticket.user_id }, select: { email: true } }) : null;
    await this.payments.email(
      attendee?.email || ticket.buyer_email,
      `Your refund for "${evName}" has been approved`,
      `<h2 style="color:#4EC98C">Refund Approved</h2>
      <p>Your refund of <strong>${amt}</strong> for <strong>${escapeHtml(evName)}</strong> has been approved.</p>
      <p>It may take <strong>5–10 business days</strong> to appear on your statement.</p>
      <p style="color:#888;font-size:12px">ChristLink · Faith Events Platform</p>`,
      `Your refund of ${amt} for ${evName} has been approved. It may take 5–10 business days to appear on your statement.`,
    );
    return { success: true, refundId: refund.id };
  }

  async deny(userId: string, id: string) {
    const request = await this.findOwnRequest(userId, id);
    if (!request) throw new NotFoundException('Request not found.');
    if (request.status !== 'pending') throw new BadRequestException('Request already resolved.');
    await this.prisma.refund_requests.update({ where: { id: request.id }, data: { status: 'denied', updated_at: new Date() } });
    const ticket = request.tickets;
    const evName = request.events?.name;
    if (ticket.user_id) {
      await this.notifications.create(
        ticket.user_id,
        'refund_denied',
        'Refund request declined',
        `Your refund request for "${evName}" was not approved. Contact the host for questions.`,
        { ticket_id: ticket.id, event_id: request.event_id },
      );
    }
    const attendee = ticket.user_id ? await this.prisma.profiles.findUnique({ where: { id: ticket.user_id }, select: { email: true } }) : null;
    await this.payments.email(
      attendee?.email || ticket.buyer_email,
      `Update on your refund request for "${evName}"`,
      `<h2 style="color:#ef4444">Refund Not Approved</h2>
      <p>Your refund request for <strong>${escapeHtml(evName ?? '')}</strong> was not approved by the host.</p>
      <p>If you have questions, please contact the event host directly.</p>
      <p style="color:#888;font-size:12px">ChristLink · Faith Events Platform</p>`,
      `Your refund request for ${evName} was not approved by the host. If you have questions, please contact the event host directly.`,
    );
    return { success: true };
  }
}
