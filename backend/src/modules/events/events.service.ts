import { BadRequestException, ConflictException, ForbiddenException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { StorageService } from '../storage/storage.service';
import {
  dbBadRequest,
  eventsWithDetails,
  geocodeAddress,
  haversineMiles,
  isUuid,
  notifyFollowersOfEvent,
  sanitizeText,
  toDate,
  toInt,
} from './event-helpers';

type Body = Record<string, unknown>;
type EventRow = Record<string, unknown> & { id: string; lat: number | null; lng: number | null };

const STRING_FIELDS = ['name', 'description', 'cover_url', 'event_type', 'age_group', 'format', 'denomination',
  'venue_name', 'address', 'city', 'state', 'zip', 'online_url'];
const ARRAY_FIELDS = ['tags', 'gallery_urls'];
const BOOL_FIELDS = ['is_paid', 'absorb_stripe_fee', 'forum_enabled'];
const DATE_FIELDS = ['start_date', 'end_date', 'sales_cutoff', 'publish_at'];

/** Picks `keys` from a loose body and checks each value's type (trust boundary; server.js relied on Postgres). */
export function pickEventFields(body: Body, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    const v = body[k];
    if (v === undefined) continue;
    if (STRING_FIELDS.includes(k)) {
      if (v !== null && typeof v !== 'string') throw new BadRequestException(`Invalid ${k}.`);
      out[k] = k === 'name' || k === 'description' ? sanitizeText(v) : v;
    } else if (ARRAY_FIELDS.includes(k)) {
      if (v !== null && !(Array.isArray(v) && v.every((x) => typeof x === 'string'))) throw new BadRequestException(`Invalid ${k}.`);
      out[k] = v ?? [];
    } else if (BOOL_FIELDS.includes(k)) {
      if (typeof v !== 'boolean') throw new BadRequestException(`Invalid ${k}.`);
      out[k] = v;
    } else if (DATE_FIELDS.includes(k)) out[k] = toDate(v, k);
    else if (k === 'max_capacity') out[k] = toInt(v, k);
  }
  return out;
}

const PATCH_FIELDS = ['name', 'description', 'event_type', 'age_group', 'format', 'denomination', 'tags', 'start_date',
  'end_date', 'sales_cutoff', 'venue_name', 'address', 'city', 'state', 'zip', 'online_url', 'max_capacity',
  'gallery_urls', 'forum_enabled', 'cover_url'];

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly storage: StorageService,
  ) {}

  async list(q: Record<string, string | undefined>) {
    const { city, type, is_paid, format, host_id, lat, lng } = q;
    const search = q.q;
    const radius = q.radius ?? '100';
    const limit = Math.min(Math.max(parseInt(q.limit ?? '') || 50, 1), 200);
    const offset = Math.max(parseInt(q.offset ?? '') || 0, 0);
    const useRadius = !!(lat && lng);
    const where: Prisma.Sql[] = [Prisma.sql`e.status = 'published'`];
    if (!useRadius && city) where.push(Prisma.sql`e.city ilike ${`%${city}%`}`);
    if (type) where.push(Prisma.sql`e.event_type ilike ${`%${type}%`}`);
    if (format) where.push(Prisma.sql`e.format = ${format}`);
    if (host_id) {
      if (!isUuid(host_id)) return { events: [] };
      where.push(Prisma.sql`e.host_id = ${host_id}::uuid`);
    } else if (q.include_past !== 'true') {
      // Public listings only show events that haven't ended yet
      where.push(Prisma.sql`(e.end_date >= now() or e.start_date >= now() or (e.start_date is null and e.end_date is null))`);
    }
    if (is_paid !== undefined) where.push(Prisma.sql`e.is_paid = ${is_paid === 'true'}`);
    if (search) {
      const like = `%${search}%`;
      where.push(Prisma.sql`(e.name ilike ${like} or e.description ilike ${like} or e.city ilike ${like} or e.event_type ilike ${like})`);
    }
    // Fetch more when doing a radius filter so there is enough to filter from
    const take = useRadius ? 500 : limit;
    let events = await this.prisma.$queryRaw<EventRow[]>(
      eventsWithDetails(Prisma.join(where, ' and '), Prisma.sql`order by e.start_date asc nulls last, e.id limit ${take} offset ${offset}`),
    );
    if (useRadius) {
      const uLat = parseFloat(lat!), uLng = parseFloat(lng!), r = parseFloat(radius);
      // Events without coordinates are excluded from radius search
      events = events.filter((ev) => !!(ev.lat && ev.lng) && haversineMiles(uLat, uLng, ev.lat!, ev.lng!) <= r);
    }
    return { events };
  }

  async get(id: string, viewerId?: string) {
    if (!isUuid(id)) throw new NotFoundException('Event not found.');
    const [ev] = await this.prisma.$queryRaw<EventRow[]>(eventsWithDetails(Prisma.sql`e.id = ${id}::uuid`));
    if (!ev) throw new NotFoundException('Event not found.');
    // Drafts are private to their host (and admins); server.js showed them to anyone with the id
    if (ev.status === 'draft' && ev.host_id !== viewerId) {
      const viewer = viewerId ? await this.prisma.profiles.findUnique({ where: { id: viewerId }, select: { role: true } }) : null;
      if (viewer?.role !== 'admin') throw new NotFoundException('Event not found.');
    }
    return ev;
  }

  async create(userId: string, body: Body) {
    if (!body.name) throw new BadRequestException('Event name is required.');
    const f = pickEventFields(body, [...PATCH_FIELDS, 'is_paid', 'absorb_stripe_fee', 'publish_at']);
    await this.prisma.profiles.updateMany({ where: { id: userId, role: 'attendee' }, data: { role: 'host' } });
    // Geocode the address for Near Me radius search
    const coords = f.format !== 'online' ? await geocodeAddress([f.address, f.city, f.state, f.zip]) : null;
    return dbBadRequest(
      this.prisma.events.create({
        data: {
          ...f,
          host_id: userId,
          name: f.name as string,
          cover_url: (f.cover_url as string) || null,
          gallery_urls: (f.gallery_urls as string[]) ?? [],
          age_group: (f.age_group as string) || 'All Ages',
          format: (f.format as string) || 'in_person',
          is_paid: (f.is_paid as boolean) || false,
          absorb_stripe_fee: f.absorb_stripe_fee !== false,
          sales_cutoff: (f.sales_cutoff as Date) || (f.end_date as Date) || null,
          max_capacity: (f.max_capacity as number) || null,
          forum_enabled: f.forum_enabled !== false,
          status: 'draft',
          lat: coords?.lat || null,
          lng: coords?.lng || null,
        },
      }),
    );
  }

  /** Host's own event or 404 `Event not found or not yours.` (server.js filtered on host_id). */
  private async ownEvent(id: string, userId: string) {
    const ev = isUuid(id) ? await this.prisma.events.findFirst({ where: { id, host_id: userId } }) : null;
    if (!ev) throw new NotFoundException('Event not found or not yours.');
    return ev;
  }

  /** Event or 404 `Event not found.`, then 403 `Not your event.` for anyone but the host. */
  private async hostedEvent(id: string, userId: string) {
    const ev = isUuid(id) ? await this.prisma.events.findUnique({ where: { id } }) : null;
    if (!ev) throw new NotFoundException('Event not found.');
    if (ev.host_id !== userId) throw new ForbiddenException('Not your event.');
    return ev;
  }

  async update(id: string, userId: string, body: Body) {
    await this.ownEvent(id, userId);
    const updates: Record<string, unknown> = pickEventFields(body, PATCH_FIELDS);
    if (!Object.keys(updates).length) throw new BadRequestException('No fields to update.');
    const addrChanged = ['address', 'city', 'state', 'zip', 'venue_name'].some((k) => body[k] !== undefined);
    if (addrChanged && body.format !== 'online') {
      const coords = await geocodeAddress([body.address, body.city, body.state, body.zip]);
      if (coords) Object.assign(updates, coords);
    }
    updates.updated_at = new Date();
    return dbBadRequest(this.prisma.events.update({ where: { id }, data: updates }));
  }

  async publish(id: string, userId: string) {
    const ev = await this.ownEvent(id, userId);
    if (ev.status !== 'draft') throw new BadRequestException('Only draft events can be published.');
    if (ev.is_paid && !ev.listing_fee_paid) throw new HttpException('Listing fee required.', 402);
    const updated = await this.prisma.events.update({ where: { id }, data: { status: 'published', publish_at: null } });
    void notifyFollowersOfEvent(this.prisma, this.notifications, updated);
    return updated;
  }

  async schedule(id: string, userId: string, publishAt: unknown) {
    if (!publishAt) throw new BadRequestException('publish_at is required.');
    const date = new Date(publishAt as string);
    if (isNaN(date.getTime()) || date <= new Date()) throw new BadRequestException('Schedule date must be in the future.');
    const ev = await this.ownEvent(id, userId);
    if (ev.status !== 'draft') throw new BadRequestException('Only draft events can be scheduled.');
    if (ev.is_paid && !ev.listing_fee_paid) throw new HttpException('Listing fee required to schedule a paid event.', 402);
    return this.prisma.events.update({ where: { id }, data: { publish_at: date } });
  }

  async remove(id: string, userId: string) {
    const ev = await this.ownEvent(id, userId);
    // Soft-cancel instead of deleting when tickets exist, so payment records survive (server.js: published only)
    const hasTickets = !!(await this.prisma.tickets.findFirst({ where: { event_id: id }, select: { id: true } }));
    if (ev.status === 'published' || hasTickets) {
      await this.prisma.events.update({ where: { id }, data: { status: 'cancelled' } });
      return { success: true, action: 'cancelled' };
    }
    await this.prisma.events.delete({ where: { id } });
    return { success: true, action: 'deleted' };
  }

  async toggleVisibility(id: string, userId: string) {
    const ev = await this.hostedEvent(id, userId);
    const status = ev.status === 'published' ? 'draft' : 'published';
    // server.js skipped this check, which let a paid event go live without its listing fee
    if (status === 'published' && ev.is_paid && !ev.listing_fee_paid) throw new HttpException('Listing fee required.', 402);
    await this.prisma.events.update({ where: { id }, data: { status } });
    return { success: true, status };
  }

  async duplicate(id: string, userId: string) {
    const ev = await this.hostedEvent(id, userId);
    // Fresh draft: no ids, timestamps, listing payment, counters or schedule
    const { id: _id, created_at, updated_at, listing_fee_paid, listing_payment_id, ...rest } = ev;
    const event = await this.prisma.$transaction(async (tx) => {
      const copy = await tx.events.create({
        data: {
          ...rest,
          tags: rest.tags ?? undefined,
          name: `${ev.name} (Copy)`,
          status: 'draft',
          listing_fee_paid: false,
          listing_payment_id: null,
          publish_at: null,
          rsvp_count: 0,
          view_count: 0,
        },
      });
      const types = await tx.ticket_types.findMany({ where: { event_id: id } });
      if (types.length) {
        await tx.ticket_types.createMany({
          data: types.map(({ id: _t, created_at: _c, ...tt }) => ({ ...tt, event_id: copy.id, sold: 0 })),
        });
      }
      return copy;
    });
    return { event };
  }

  async attendees(id: string, viewerId?: string) {
    if (!isUuid(id)) return { attendees: [], total: 0 };
    const [rsvpRows, ticketRows, ev] = await Promise.all([
      this.prisma.rsvps.findMany({ where: { event_id: id, status: 'confirmed' }, select: { user_id: true }, take: 100 }),
      this.prisma.tickets.findMany({ where: { event_id: id, status: 'confirmed' }, select: { user_id: true }, take: 100 }),
      this.prisma.events.findUnique({ where: { id }, select: { host_id: true } }),
    ]);
    let userIds = [...new Set([...rsvpRows, ...ticketRows].map((r) => r.user_id).filter((u): u is string => !!u))];
    if (ev?.host_id !== viewerId) userIds = await this.withoutHiddenAttendees(userIds, viewerId);
    if (!userIds.length) return { attendees: [], total: 0 };
    const profiles = await this.prisma.profiles.findMany({
      where: { id: { in: userIds } },
      select: { id: true, full_name: true, bio: true, city: true, avatar_url: true, avatar_color: true,
        instagram_url: true, facebook_url: true, tiktok_url: true },
    });
    return { attendees: profiles, total: profiles.length };
  }

  /** user_settings.hide_rsvps_from_non_friends: only mutual followers (and the person) see that attendee. */
  async withoutHiddenAttendees(userIds: string[], viewerId?: string) {
    if (!userIds.length) return userIds;
    const hidden = new Set(
      (
        await this.prisma.user_settings.findMany({
          where: { user_id: { in: userIds }, hide_rsvps_from_non_friends: true },
          select: { user_id: true },
        })
      ).map((s) => s.user_id),
    );
    if (viewerId) hidden.delete(viewerId);
    if (!hidden.size) return userIds;
    const visible = new Set<string>();
    if (viewerId) {
      const ids = [...hidden];
      const [following, followers] = await Promise.all([
        this.prisma.user_follows.findMany({ where: { follower_id: viewerId, following_id: { in: ids } }, select: { following_id: true } }),
        this.prisma.user_follows.findMany({ where: { following_id: viewerId, follower_id: { in: ids } }, select: { follower_id: true } }),
      ]);
      const back = new Set(followers.map((f) => f.follower_id));
      for (const f of following) if (back.has(f.following_id)) visible.add(f.following_id);
    }
    return userIds.filter((u) => !hidden.has(u) || visible.has(u));
  }

  async myEvents(userId: string) {
    const events = await this.prisma.$queryRaw<(EventRow & { attendee_count?: number })[]>(
      eventsWithDetails(Prisma.sql`e.host_id = ${userId}::uuid`, Prisma.sql`order by e.created_at desc`),
    );
    if (events.length) {
      const eventIds = events.map((e) => e.id);
      const [tickets, rsvps] = await Promise.all([
        this.prisma.tickets.findMany({ where: { event_id: { in: eventIds }, status: 'confirmed' }, select: { event_id: true, quantity: true } }),
        this.prisma.rsvps.findMany({ where: { event_id: { in: eventIds }, status: 'confirmed' }, select: { event_id: true } }),
      ]);
      const counts: Record<string, number> = {};
      for (const t of tickets) counts[t.event_id] = (counts[t.event_id] || 0) + (t.quantity || 1);
      for (const r of rsvps) counts[r.event_id] = (counts[r.event_id] || 0) + 1;
      for (const ev of events) ev.attendee_count = counts[ev.id] || 0;
    }
    return { events };
  }

  async sales(id: string, userId: string) {
    const ev = isUuid(id)
      ? await this.prisma.events.findUnique({ where: { id }, select: { id: true, name: true, host_id: true, is_paid: true } })
      : null;
    if (!ev) throw new NotFoundException('Event not found.');
    if (ev.host_id !== userId) throw new ForbiddenException('Not your event.');
    const profileSelect = { select: { id: true, full_name: true, email: true, avatar_url: true, avatar_color: true } };
    const [ticketRows, rsvpRows] = await Promise.all([
      this.prisma.tickets.findMany({
        where: { event_id: id },
        orderBy: { created_at: 'desc' },
        select: { id: true, quantity: true, unit_price_cents: true, total_charged_cents: true, platform_fee_cents: true,
          host_receives_cents: true, status: true, confirmed_at: true, created_at: true, buyer_email: true, code: true,
          ticket_type_id: true, user_id: true, ticket_types: { select: { name: true } }, profiles: profileSelect },
      }),
      this.prisma.rsvps.findMany({
        where: { event_id: id, status: 'confirmed' },
        orderBy: { created_at: 'desc' },
        select: { id: true, created_at: true, user_id: true, profiles: profileSelect },
      }),
    ]);
    const confirmed = ticketRows.filter((t) => t.status === 'confirmed');
    const sum = (f: (t: (typeof confirmed)[number]) => number) => confirmed.reduce((s, t) => s + f(t), 0);
    return {
      event: ev,
      tickets: ticketRows,
      rsvps: rsvpRows,
      summary: {
        totalTicketsSold: sum((t) => t.quantity || 1),
        totalRsvps: rsvpRows.length,
        grossRevenue: sum((t) => t.total_charged_cents || 0),
        platformFees: sum((t) => t.platform_fee_cents || 0),
        hostEarnings: sum((t) => t.host_receives_cents || 0),
      },
    };
  }

  async invite(eventId: string, userId: string, followerIds: unknown) {
    if (!Array.isArray(followerIds) || followerIds.length === 0) throw new BadRequestException('No followers selected.');
    if (followerIds.length > 100) throw new BadRequestException('Cannot invite more than 100 people at once.');
    const ev = isUuid(eventId)
      ? await this.prisma.events.findUnique({ where: { id: eventId }, select: { id: true, name: true, host_id: true } })
      : null;
    if (!ev) throw new NotFoundException('Event not found.');
    if (ev.host_id !== userId) throw new ForbiddenException('Only the host can send invites.');
    const host = await this.prisma.profiles.findUnique({ where: { id: userId }, select: { full_name: true } });
    const hostName = host?.full_name || 'Someone';
    // Only real profiles (a bad id used to fail the whole insert)
    const ids = [...new Set(followerIds.filter(isUuid))];
    const recipients = await this.prisma.profiles.findMany({ where: { id: { in: ids } }, select: { id: true } });
    for (const r of recipients) {
      await this.notifications.create(r.id, 'event_invite', `${hostName} invited you to an event`, ev.name, {
        event_id: ev.id,
        event_name: ev.name,
        eventId: ev.id,
      });
    }
    return { sent: recipients.length };
  }

  // ── Ticket types ──────────────────────────────────────────
  async createTicketType(userId: string, body: Body) {
    const { event_id, name, price_cents, quantity } = body;
    if (!event_id || !name || !price_cents) throw new BadRequestException('event_id, name, price_cents required.');
    const ev = isUuid(event_id) ? await this.prisma.events.findFirst({ where: { id: event_id, host_id: userId } }) : null;
    if (!ev) throw new ForbiddenException('Not your event.');
    if (typeof name !== 'string') throw new BadRequestException('Invalid name.');
    const price = toInt(price_cents, 'price_cents')!;
    if (price < 0) throw new BadRequestException('price_cents must be zero or more.');
    return dbBadRequest(
      this.prisma.ticket_types.create({
        data: { event_id: ev.id, name, price_cents: price, quantity: toInt(quantity, 'quantity') || null, sold: 0 },
      }),
    );
  }

  async updateTicketType(id: string, userId: string, body: Body) {
    const tt = isUuid(id)
      ? await this.prisma.ticket_types.findUnique({ where: { id }, include: { events: { select: { host_id: true } } } })
      : null;
    if (!tt) throw new NotFoundException('Ticket type not found.');
    if (tt.events.host_id !== userId) throw new ForbiddenException('Not your event.');
    const data: Prisma.ticket_typesUpdateInput = {};
    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || !body.name.trim()) throw new BadRequestException('Name is required.');
      data.name = sanitizeText(body.name);
    }
    if (body.price_cents !== undefined) {
      const price = toInt(body.price_cents, 'price_cents');
      if (price === null || price < 0) throw new BadRequestException('price_cents must be zero or more.');
      data.price_cents = price;
    }
    if (body.quantity !== undefined) {
      const q = toInt(body.quantity, 'quantity');
      if (q !== null && q < 1) throw new BadRequestException('quantity must be at least 1.');
      data.quantity = q;
    }
    if (body.sales_start !== undefined) data.sales_start = toDate(body.sales_start, 'sales_start');
    if (body.sales_end !== undefined) data.sales_end = toDate(body.sales_end, 'sales_end');
    if (body.sort_order !== undefined) data.sort_order = toInt(body.sort_order, 'sort_order') ?? 0;
    if (!Object.keys(data).length) throw new BadRequestException('No fields to update.');
    const err = ticketTypeChangeError(tt, data.quantity as number | null | undefined, data.price_cents as number | undefined);
    if (err) throw new BadRequestException(err);
    // Guard against a sale landing between the check and the write
    const where: Prisma.ticket_typesWhereInput = { id, sold: tt.sold };
    const { count } = await dbBadRequest(this.prisma.ticket_types.updateMany({ where, data }));
    if (!count) throw new ConflictException('Tickets just sold. Refresh and try again.');
    return this.prisma.ticket_types.findUnique({ where: { id } });
  }

  // ── Coupons ───────────────────────────────────────────────
  private async assertHost(eventId: string, userId: string) {
    const ev = isUuid(eventId) ? await this.prisma.events.findUnique({ where: { id: eventId }, select: { host_id: true } }) : null;
    if (!ev || ev.host_id !== userId) throw new ForbiddenException('Not your event.');
  }

  async listCoupons(eventId: string, userId: string) {
    await this.assertHost(eventId, userId);
    const coupons = await this.prisma.coupons.findMany({ where: { event_id: eventId }, orderBy: { created_at: 'desc' } });
    return { coupons };
  }

  async createCoupon(eventId: string, userId: string, body: Body) {
    const { code, discount_type, discount_value, max_uses, expires_at } = body;
    if (!code || !discount_type || !discount_value) throw new BadRequestException('code, discount_type, discount_value required.');
    await this.assertHost(eventId, userId);
    if (typeof code !== 'string' || typeof discount_type !== 'string') throw new BadRequestException('Invalid coupon.');
    return dbBadRequest(
      this.prisma.coupons.create({
        data: {
          event_id: eventId,
          host_id: userId,
          code: code.trim().toUpperCase(),
          discount_type,
          discount_value: toInt(discount_value, 'discount_value')!,
          max_uses: toInt(max_uses, 'max_uses') || null,
          expires_at: toDate(expires_at, 'expires_at'),
          active: true,
        },
      }),
      'Invalid coupon.',
    );
  }

  async deactivateCoupon(couponId: string, userId: string) {
    const coupon = isUuid(couponId) ? await this.prisma.coupons.findUnique({ where: { id: couponId }, select: { host_id: true } }) : null;
    if (!coupon || coupon.host_id !== userId) throw new ForbiddenException('Not your coupon.');
    await this.prisma.coupons.update({ where: { id: couponId }, data: { active: false } });
    return { success: true };
  }

  async validateCoupon(eventId: string, body: Body) {
    const { code, ticketPriceCents, qty } = body as { code?: unknown; ticketPriceCents?: number; qty?: number };
    if (!code) throw new BadRequestException('Code required.');
    if (typeof code !== 'string') throw new NotFoundException('Invalid coupon code.');
    const coupon = isUuid(eventId)
      ? await this.prisma.coupons.findFirst({ where: { event_id: eventId, code: code.trim().toUpperCase(), active: true } })
      : null;
    if (!coupon) throw new NotFoundException('Invalid coupon code.');
    if (coupon.expires_at && coupon.expires_at < new Date()) throw new BadRequestException('This coupon has expired.');
    if (coupon.max_uses && coupon.uses >= coupon.max_uses) throw new BadRequestException('This coupon has reached its usage limit.');
    return couponQuote(coupon, ticketPriceCents, qty);
  }

  // ── Uploads ───────────────────────────────────────────────
  async upload(prefix: 'events' | 'forum', userId: string, dataUrl: unknown) {
    return { url: await this.storage.putDataUrl(prefix, userId, dataUrl) };
  }
}

/** Why a ticket type change is refused once tickets have sold, or null. */
export function ticketTypeChangeError(
  tt: { sold: number | null; price_cents: number },
  quantity: number | null | undefined,
  price: number | undefined,
): string | null {
  const sold = tt.sold ?? 0;
  if (quantity != null && quantity < sold) return `Quantity can't be lower than the ${sold} tickets already sold.`;
  if (price !== undefined && price !== tt.price_cents && sold > 0) return "Price can't change after tickets have sold.";
  return null;
}

/** server.js validate-coupon response. Fixed discounts are stored in dollars. */
export function couponQuote(
  coupon: { id: string; discount_type: string; discount_value: number },
  ticketPriceCents: number | undefined,
  qty: number | undefined,
) {
  const face = (ticketPriceCents as number) * (qty || 1);
  const discountCents =
    coupon.discount_type === 'percent'
      ? Math.round((face * coupon.discount_value) / 100)
      : Math.min(coupon.discount_value * 100, face);
  return {
    valid: true,
    couponId: coupon.id,
    discountType: coupon.discount_type,
    discountValue: coupon.discount_value,
    discountCents,
    newTotal: Math.max(0, face - discountCents),
    label: coupon.discount_type === 'percent' ? `${coupon.discount_value}% off` : `$${coupon.discount_value.toFixed(2)} off`,
  };
}
