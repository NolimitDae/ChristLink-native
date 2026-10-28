import { BadRequestException, Logger } from '@nestjs/common';
import { Prisma } from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

const log = new Logger('Events');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Postgres rejects malformed uuids with an error; server.js answered "not found" for those, so callers check first. */
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);

/** server.js sanitizeText: strip HTML tags to prevent stored XSS. */
export function sanitizeText<T>(str: T): T {
  if (typeof str !== 'string') return str;
  return str.replace(/<[^>]*>/g, '').trim() as T;
}

/** Loose body value → Date | null (Postgres accepted any date string; Prisma wants a Date). */
export function toDate(v: unknown, field: string): Date | null {
  if (v === null || v === '' || v === undefined) return null;
  if (typeof v !== 'string' && typeof v !== 'number') throw new BadRequestException(`Invalid ${field}.`);
  const d = new Date(v);
  if (isNaN(d.getTime())) throw new BadRequestException(`Invalid ${field}.`);
  return d;
}

/** Loose body value → integer | null (Postgres coerced "100"; Prisma does not). */
export function toInt(v: unknown, field: string): number | null {
  if (v === null || v === '' || v === undefined) return null;
  const n = Number(v);
  if (!Number.isInteger(n)) throw new BadRequestException(`${field} must be a whole number.`);
  return n;
}

/** Bad input that reaches the database (wrong type, check constraint, FK) is a 400 like server.js, not a 500. */
export async function dbBadRequest<T>(p: Promise<T>, message = 'Invalid request data.'): Promise<T> {
  try {
    return await p;
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError ||
      e instanceof Prisma.PrismaClientValidationError ||
      (e as Error)?.name === 'DriverAdapterError'
    ) {
      log.warn(`rejected write: ${(e as Error).message.split('\n').slice(-1)[0]}`);
      throw new BadRequestException((e as { code?: string }).code === 'P2002' ? 'That already exists.' : message);
    }
    throw e;
  }
}

export function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** server.js geocodeAddress: Nominatim (free, no key). Null on any failure. */
export async function geocodeAddress(parts: unknown[]): Promise<{ lat: number; lng: number } | null> {
  const q = parts.filter((p) => typeof p === 'string' && p).join(', ');
  if (!q) return null;
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`, {
      headers: { 'User-Agent': 'ChristLink/1.0' },
      signal: AbortSignal.timeout(5000),
    });
    const data = (await res.json()) as { lat: string; lon: string }[];
    if (data?.[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    // geocoding is best effort
  }
  return null;
}

/** The dropped `events_with_details` view: every view column, host fields, ticket_types json, confirmed_rsvps. */
export function eventsWithDetails(where: Prisma.Sql, tail: Prisma.Sql = Prisma.empty) {
  return Prisma.sql`
    select e.id, e.host_id, e.name, e.description, e.emoji, e.cover_url, e.gallery_urls, e.event_type, e.age_group,
      e.format, e.denomination, e.tags, e.is_paid, e.absorb_stripe_fee, e.start_date, e.end_date, e.venue_name,
      e.address, e.city, e.state, e.zip, e.online_url, e.max_capacity, e.forum_enabled, e.status, e.listing_fee_paid,
      e.listing_payment_id, e.publish_at, e.lat, e.lng, e.created_at, e.updated_at,
      p.full_name as host_name, p.avatar_url as host_avatar, p.avatar_color as host_avatar_color,
      coalesce((select json_agg(t.* order by t.sort_order, t.price_cents) from public.ticket_types t
                 where t.event_id = e.id), '[]'::json) as ticket_types,
      (select count(*) from public.rsvps r where r.event_id = e.id and r.status = 'confirmed')::int as confirmed_rsvps,
      e.rsvp_count, e.requires_approval, e.view_count, e.sales_cutoff
    from public.events e join public.profiles p on p.id = e.host_id
    where ${where} ${tail}`;
}

/** Tells a host's followers about a newly published event ('new_event'). Best effort: logs, never throws. */
export async function notifyFollowersOfEvent(
  prisma: PrismaService,
  notifications: NotificationsService,
  ev: { id: string; name: string; host_id: string },
) {
  try {
    const [host, followers] = await Promise.all([
      prisma.profiles.findUnique({ where: { id: ev.host_id }, select: { full_name: true } }),
      prisma.user_follows.findMany({ where: { following_id: ev.host_id }, select: { follower_id: true } }),
    ]);
    const title = `${host?.full_name || 'Someone you follow'} posted a new event`;
    for (const f of followers) {
      await notifications.create(f.follower_id, 'new_event', title, ev.name, {
        eventId: ev.id,
        event_id: ev.id,
        event_name: ev.name,
      });
    }
  } catch (e) {
    log.error(`new_event notifications for ${ev.id} failed: ${(e as Error).message}`);
  }
}

/** server.js auto-publisher: drafts whose publish_at has passed (paid ones only once the listing fee is paid). */
export async function publishDueEvents(prisma: PrismaService, notifications: NotificationsService) {
  const due = await prisma.events.findMany({
    where: { status: 'draft', publish_at: { lte: new Date() } },
    select: { id: true, name: true, host_id: true, is_paid: true, listing_fee_paid: true },
  });
  let published = 0;
  for (const ev of due) {
    if (ev.is_paid && !ev.listing_fee_paid) continue;
    // Conditional update so two workers never publish (and notify) twice
    const { count } = await prisma.events.updateMany({
      where: { id: ev.id, status: 'draft' },
      data: { status: 'published', publish_at: null },
    });
    if (!count) continue;
    published++;
    await notifyFollowersOfEvent(prisma, notifications, ev);
  }
  return published;
}
