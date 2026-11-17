import { BadRequestException, ForbiddenException, HttpException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { InjectRedis } from '../../redis';
import { NotificationsService } from '../notifications/notifications.service';
import { CacheService } from '../../cache/cache.service';
import { parseDataUrl, StorageService } from '../storage/storage.service';
import { FlyerReaderService } from './flyer-reader';
import { JsonError } from '../payments/json-error';
import { dbBadRequest, geocodeAddress, isUuid, sanitizeText, toDate } from './event-helpers';
import { EventPreview, fetchImageDataUrl, fetchListingHtml, normalizeListingUrl, parseEventPage, publicHttpUrl } from './link-preview';

type Body = Record<string, unknown>;

const FORMATS = ['in_person', 'online', 'hybrid'];
const DAY = 86_400_000;
/** A member can share this many events a day (reposts go live at once, so this caps spam). */
export const REPOSTS_PER_DAY = 5;
/** Flyers read automatically per member per day (each one is a paid AI request); more are still saved as pictures. */
export const FLYER_READS_PER_DAY = 10;

const str = (v: unknown, field: string, max: number): string | null => {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'string') throw new BadRequestException(`Invalid ${field}.`);
  const out = sanitizeText(v);
  if (out.length > max) throw new BadRequestException(`${field} is too long.`);
  return out || null;
};

/** A link a member typed for a repost: public http(s) only, stored tidy. Null when empty. */
export function repostLink(v: unknown): string | null {
  if (v === undefined || v === null || v === '') return null;
  return publicHttpUrl(v).toString();
}

/**
 * Reposts: a member shares an event that's listed somewhere else. Stored as an event with is_repost = true (see the
 * migration), published at once, free here ("I'm going" is an ordinary RSVP), with its forum on.
 */
@Injectable()
export class RepostsService {
  private readonly logger = new Logger('Reposts');

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly storage: StorageService,
    private readonly cache: CacheService,
    private readonly flyers: FlyerReaderService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  /**
   * A flyer photo for the share form: saved as the event's picture and, when flyer reading is set up
   * (flyer-reader.ts), read for the details. `read` tells the app whether anything was filled in.
   */
  async flyer(userId: string, dataUrl: unknown): Promise<{ preview: Record<string, unknown>; read: boolean }> {
    const { buffer } = parseDataUrl(dataUrl);
    const cover_url = await this.storage.putDataUrl('events', userId, dataUrl);
    let fields: Record<string, unknown> | null = null;
    if (this.flyers.enabled && (await this.underFlyerLimit(userId))) fields = await this.flyers.read(buffer);
    return { preview: { ...(fields ?? {}), cover_url }, read: !!fields };
  }

  private async underFlyerLimit(userId: string): Promise<boolean> {
    try {
      const key = `flyer-reads:${userId}:${new Date().toISOString().slice(0, 10)}`;
      const n = await this.redis.incr(key);
      if (n === 1) await this.redis.expire(key, 2 * 86_400);
      return n <= FLYER_READS_PER_DAY;
    } catch {
      return false; // can't count → don't spend
    }
  }

  /** Validated repost fields from a loose body. `partial` (editing) only checks what was sent. */
  fields(body: Body, partial = false) {
    const has = (k: string) => body[k] !== undefined;
    const out: Record<string, unknown> = {};
    if (!partial || has('name')) {
      const name = str(body.name, 'Event name', 120);
      if (!name || name.length < 3) throw new BadRequestException('Add the event’s name (at least 3 characters).');
      out.name = name;
    }
    if (!partial || has('organizer_name')) {
      const organizer = str(body.organizer_name, 'Organizer', 120);
      if (!organizer) throw new BadRequestException('Add who is hosting the event.');
      out.organizer_name = organizer;
    }
    if (!partial || has('start_date')) {
      const start = toDate(body.start_date, 'start_date');
      if (!start) throw new BadRequestException('Add when the event starts.');
      if (start.getTime() < Date.now() - DAY) throw new BadRequestException('That date has already passed.');
      if (start.getTime() > Date.now() + 730 * DAY) throw new BadRequestException('That date is too far away.');
      out.start_date = start;
    }
    if (has('end_date')) out.end_date = toDate(body.end_date, 'end_date');
    if (!partial || has('format')) {
      const format = body.format ?? 'in_person';
      if (typeof format !== 'string' || !FORMATS.includes(format)) throw new BadRequestException('Invalid format.');
      out.format = format;
    }
    if (has('description')) out.description = str(body.description, 'Description', 2000);
    if (has('event_type')) out.event_type = str(body.event_type, 'Type', 60);
    if (has('venue_name')) out.venue_name = str(body.venue_name, 'Venue', 200);
    if (has('address')) out.address = str(body.address, 'Address', 300);
    if (has('city')) out.city = str(body.city, 'City', 100);
    if (has('state')) out.state = str(body.state, 'State', 50);
    if (has('zip')) out.zip = str(body.zip, 'ZIP', 20);
    if (has('cover_url')) out.cover_url = str(body.cover_url, 'Image', 1000);
    if (has('online_url')) out.online_url = repostLink(body.online_url);
    if (has('source_url')) out.source_url = repostLink(body.source_url);
    if (has('ticket_url')) out.ticket_url = repostLink(body.ticket_url);
    return out;
  }

  async create(userId: string, body: Body) {
    const f = this.fields(body);
    const start = f.start_date as Date;
    if (f.end_date && (f.end_date as Date).getTime() <= start.getTime()) throw new BadRequestException('The end must be after the start.');
    if (f.format !== 'online' && !f.city) throw new BadRequestException('Add the city where it’s happening.');

    // Same listing already shared and still upcoming → send people to that page instead of a duplicate
    if (f.source_url) {
      const wanted = normalizeListingUrl(f.source_url as string);
      const candidates = await this.prisma.events.findMany({
        where: { is_repost: true, status: 'published', source_url: { not: null }, start_date: { gte: new Date(Date.now() - DAY) } },
        select: { id: true, source_url: true },
        orderBy: { created_at: 'desc' },
        take: 500,
      });
      const existing = candidates.find((c) => normalizeListingUrl(c.source_url as string) === wanted);
      if (existing) throw new JsonError(409, { error: 'Someone has already shared this event.', existingId: existing.id });
    }
    const recent = await this.prisma.events.count({ where: { host_id: userId, is_repost: true, created_at: { gte: new Date(Date.now() - DAY) } } });
    if (recent >= REPOSTS_PER_DAY) throw new HttpException(`You can share up to ${REPOSTS_PER_DAY} events a day. Try again tomorrow.`, 429);

    const coords = f.format !== 'online' ? await geocodeAddress([f.address, f.city, f.state, f.zip]) : null;
    const event = await dbBadRequest(
      this.prisma.events.create({
        data: {
          ...f,
          name: f.name as string,
          host_id: userId,
          is_repost: true,
          is_paid: false,
          forum_enabled: true,
          status: 'published',
          age_group: 'All Ages',
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
        },
      }),
    );
    await this.cache.bump('events');
    void this.notifyFollowers(event);
    return { event };
  }

  /** Edits a repost's own fields (the member who shared it only). */
  async update(id: string, userId: string, body: Body) {
    const ev = isUuid(id) ? await this.prisma.events.findUnique({ where: { id } }) : null;
    if (!ev || !ev.is_repost) throw new NotFoundException('Event not found.');
    if (ev.host_id !== userId) throw new ForbiddenException('Only the person who shared this can edit it.');
    const f = this.fields(body, true);
    if (!Object.keys(f).length) throw new BadRequestException('No fields to update.');
    const start = (f.start_date as Date | undefined) ?? ev.start_date;
    const end = 'end_date' in f ? (f.end_date as Date | null) : ev.end_date;
    if (start && end && end.getTime() <= start.getTime()) throw new BadRequestException('The end must be after the start.');
    const format = (f.format as string | undefined) ?? ev.format;
    const city = 'city' in f ? f.city : ev.city;
    if (format !== 'online' && !city) throw new BadRequestException('Add the city where it’s happening.');
    if (['address', 'city', 'state', 'zip'].some((k) => k in f) && format !== 'online') {
      const coords = await geocodeAddress([f.address ?? ev.address, city, f.state ?? ev.state, f.zip ?? ev.zip]);
      if (coords) Object.assign(f, coords);
    }
    const event = await dbBadRequest(this.prisma.events.update({ where: { id }, data: { ...f, updated_at: new Date() } }));
    await this.cache.bump('events');
    return { event };
  }

  /**
   * Reads a listing so the share form can be filled in. The listing's picture is copied to our storage (their image
   * links expire or refuse hotlinking); if that fails the member can add a flyer themselves.
   */
  async preview(userId: string, link: unknown): Promise<{ preview: EventPreview & { cover_url?: string } }> {
    const url = publicHttpUrl(link);
    let parsed: EventPreview;
    try {
      const { html, finalUrl } = await fetchListingHtml(url);
      parsed = parseEventPage(html, finalUrl);
    } catch (e) {
      this.logger.warn(`preview of ${url.hostname} failed: ${(e as Error).message}`);
      throw new JsonError(422, {
        error: 'We couldn’t read that page. Some sites (like Facebook) block this. Fill in the details below instead.',
        source_url: url.toString(),
      });
    }
    const { image_url, ...rest } = parsed;
    let cover_url: string | undefined;
    if (image_url) {
      const dataUrl = await fetchImageDataUrl(image_url);
      if (dataUrl) cover_url = await this.storage.putDataUrl('events', userId, dataUrl).catch(() => undefined);
    }
    return { preview: { ...rest, ...(cover_url ? { cover_url } : {}) } };
  }

  private async notifyFollowers(ev: { id: string; name: string; host_id: string }) {
    try {
      const [sharer, followers] = await Promise.all([
        this.prisma.profiles.findUnique({ where: { id: ev.host_id }, select: { full_name: true } }),
        this.prisma.user_follows.findMany({ where: { following_id: ev.host_id }, select: { follower_id: true } }),
      ]);
      const title = `${sharer?.full_name || 'Someone you follow'} shared an event`;
      await this.notifications.createMany(
        followers.map((f) => ({ userId: f.follower_id, type: 'new_event', title, body: ev.name, data: { eventId: ev.id, event_id: ev.id, event_name: ev.name } })),
      );
    } catch (e) {
      this.logger.error(`repost notifications for ${ev.id} failed: ${(e as Error).message}`);
    }
  }
}
