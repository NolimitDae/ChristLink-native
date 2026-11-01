import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { isUuid } from '../events/event-helpers';

/** A paid-event "tickets are back" notice holds its place in the count of open seats for this long. */
export const NOTIFY_HOLD_HOURS = 12;

type Openings = { kind: 'free' | 'paid'; open: number };

/** Seats still open: free events count confirmed RSVPs against max_capacity; paid events add up limited ticket types. */
export function openSeats(
  ev: { is_paid: boolean | null; max_capacity: number | null },
  confirmedRsvps: number,
  ticketTypes: { quantity: number | null; sold: number | null }[],
): Openings {
  if (ev.is_paid && ticketTypes.length > 0) {
    if (ticketTypes.some((t) => t.quantity === null)) return { kind: 'paid', open: Number.POSITIVE_INFINITY };
    return { kind: 'paid', open: ticketTypes.reduce((n, t) => n + Math.max(0, (t.quantity ?? 0) - (t.sold ?? 0)), 0) };
  }
  return { kind: 'free', open: ev.max_capacity ? Math.max(0, ev.max_capacity - confirmedRsvps) : Number.POSITIVE_INFINITY };
}

/**
 * Event waitlist (Luma/Partiful for free events, Dice for paid ones). Free events: when a spot opens, the next person
 * in line gets an RSVP automatically. Paid events: the next people are told tickets are available (first to buy wins).
 */
@Injectable()
export class WaitlistService {
  private readonly log = new Logger('Waitlist');

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private async event(eventId: string) {
    const ev = isUuid(eventId)
      ? await this.prisma.events.findUnique({
          where: { id: eventId },
          select: { id: true, name: true, status: true, is_paid: true, max_capacity: true, start_date: true, end_date: true, sales_cutoff: true },
        })
      : null;
    if (!ev || ev.status !== 'published') throw new NotFoundException('Event not found.');
    return ev;
  }

  private async openings(ev: { id: string; is_paid: boolean | null; max_capacity: number | null }) {
    const [confirmed, types] = await Promise.all([
      this.prisma.rsvps.count({ where: { event_id: ev.id, status: 'confirmed' } }),
      this.prisma.ticket_types.findMany({ where: { event_id: ev.id }, select: { quantity: true, sold: true } }),
    ]);
    return openSeats(ev, confirmed, types);
  }

  private async attending(eventId: string, userId: string) {
    const [rsvp, ticket] = await Promise.all([
      this.prisma.rsvps.findFirst({ where: { event_id: eventId, user_id: userId, status: 'confirmed' }, select: { id: true } }),
      this.prisma.tickets.findFirst({ where: { event_id: eventId, user_id: userId, status: 'confirmed' }, select: { id: true } }),
    ]);
    return !!(rsvp || ticket);
  }

  /** `{ joined, status, position, waiting }`: position is 1-based among people still waiting. */
  async status(eventId: string, userId: string) {
    const ev = await this.event(eventId);
    const [row, waiting] = await Promise.all([
      this.prisma.event_waitlist.findUnique({ where: { event_id_user_id: { event_id: ev.id, user_id: userId } } }),
      this.prisma.event_waitlist.count({ where: { event_id: ev.id, status: 'waiting' } }),
    ]);
    const active = !!row && (row.status === 'waiting' || row.status === 'notified');
    const position =
      row?.status === 'waiting'
        ? await this.prisma.event_waitlist.count({ where: { event_id: ev.id, status: 'waiting', created_at: { lte: row.created_at } } })
        : null;
    return { joined: active, status: active ? row!.status : null, position, waiting };
  }

  async join(eventId: string, userId: string) {
    const ev = await this.event(eventId);
    const cutoff = ev.sales_cutoff || ev.end_date || ev.start_date;
    if (cutoff && new Date() > cutoff) throw new BadRequestException('This event has already started.');
    if (await this.attending(ev.id, userId)) throw new BadRequestException('You’re already going to this event.');
    if ((await this.openings(ev)).open > 0) throw new BadRequestException('Spots are open — RSVP or get tickets now.');
    // Re-joining puts you at the back of the line
    await this.prisma.event_waitlist.upsert({
      where: { event_id_user_id: { event_id: ev.id, user_id: userId } },
      create: { event_id: ev.id, user_id: userId },
      update: { status: 'waiting', created_at: new Date(), notified_at: null },
    });
    return this.status(ev.id, userId);
  }

  async leave(eventId: string, userId: string) {
    if (isUuid(eventId)) {
      await this.prisma.event_waitlist.updateMany({ where: { event_id: eventId, user_id: userId }, data: { status: 'left' } });
    }
    return { success: true };
  }

  /** Called after an RSVP or purchase: the person is in, so they leave the line. */
  async markIn(eventId: string, userId: string) {
    await this.prisma.event_waitlist.updateMany({
      where: { event_id: eventId, user_id: userId, status: { in: ['waiting', 'notified'] } },
      data: { status: 'promoted' },
    });
  }

  /** Call whenever seats may have opened (RSVP cancelled, ticket refunded, capacity raised). Never throws. */
  async spotsOpened(eventId: string): Promise<void> {
    try {
      const ev = await this.prisma.events.findUnique({
        where: { id: eventId },
        select: { id: true, name: true, status: true, is_paid: true, max_capacity: true, start_date: true, end_date: true },
      });
      const over = ev?.end_date ?? ev?.start_date;
      if (!ev || ev.status !== 'published' || (over && over < new Date())) return;
      if (ev.is_paid) await this.notifyPaid(ev);
      else await this.promoteFree(ev);
    } catch (e) {
      this.log.error(`waitlist for ${eventId} failed: ${(e as Error).message}`);
    }
  }

  private async promoteFree(ev: { id: string; name: string; is_paid: boolean | null; max_capacity: number | null }) {
    const promoted = await this.prisma.$transaction(async (tx) => {
      // Same lock as POST /rsvp so a promotion and a walk-up RSVP can't both take the last spot
      await tx.$queryRaw`select id from events where id = ${ev.id}::uuid for update`;
      const confirmed = await tx.rsvps.count({ where: { event_id: ev.id, status: 'confirmed' } });
      const { open } = openSeats(ev, confirmed, []);
      if (open <= 0) return [];
      const next = await tx.event_waitlist.findMany({
        where: { event_id: ev.id, status: 'waiting' },
        orderBy: { created_at: 'asc' },
        take: Number.isFinite(open) ? open : 500,
        select: { id: true, user_id: true },
      });
      for (const w of next) {
        await tx.rsvps.upsert({
          where: { event_id_user_id: { event_id: ev.id, user_id: w.user_id } },
          create: { event_id: ev.id, user_id: w.user_id, status: 'confirmed' },
          update: { status: 'confirmed' },
        });
        await tx.event_waitlist.update({ where: { id: w.id }, data: { status: 'promoted', notified_at: new Date() } });
      }
      return next;
    });
    for (const w of promoted) {
      await this.notifications.create(w.user_id, 'waitlist_promoted', `You’re in — ${ev.name}`, 'A spot opened up and we saved it for you. See you there!', {
        eventId: ev.id,
      });
    }
  }

  private async notifyPaid(ev: { id: string; name: string; is_paid: boolean | null; max_capacity: number | null }) {
    const { open } = await this.openings(ev);
    if (open <= 0) return;
    const holding = await this.prisma.event_waitlist.count({
      where: { event_id: ev.id, status: 'notified', notified_at: { gt: new Date(Date.now() - NOTIFY_HOLD_HOURS * 3_600_000) } },
    });
    const take = Number.isFinite(open) ? Math.max(0, open - holding) : 500;
    if (take === 0) return;
    const next = await this.prisma.event_waitlist.findMany({
      where: { event_id: ev.id, status: 'waiting' },
      orderBy: { created_at: 'asc' },
      take,
      select: { id: true, user_id: true },
    });
    if (!next.length) return;
    await this.prisma.event_waitlist.updateMany({ where: { id: { in: next.map((w) => w.id) } }, data: { status: 'notified', notified_at: new Date() } });
    for (const w of next) {
      await this.notifications.create(w.user_id, 'waitlist_spot', `Tickets are available — ${ev.name}`, 'A ticket just opened up. Grab it before someone else does.', {
        eventId: ev.id,
      });
    }
  }
}
