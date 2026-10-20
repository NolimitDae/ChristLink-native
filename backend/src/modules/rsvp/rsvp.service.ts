import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { isUuid } from '../events/event-helpers';

@Injectable()
export class RsvpService {
  private readonly log = new Logger('Rsvp');

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async get(eventId: string, userId: string) {
    const rsvp = isUuid(eventId)
      ? await this.prisma.rsvps.findUnique({
          where: { event_id_user_id: { event_id: eventId, user_id: userId } },
          select: { id: true, status: true },
        })
      : null;
    return { rsvp };
  }

  async mine(userId: string) {
    const rows = await this.prisma.rsvps.findMany({
      where: { user_id: userId, status: 'confirmed' },
      orderBy: { created_at: 'desc' },
    });
    if (!rows.length) return { rsvps: [] };
    const events = await this.prisma.events.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.event_id))] } },
      select: { id: true, name: true, start_date: true, city: true, cover_url: true },
    });
    const byId = new Map(events.map((e) => [e.id, e]));
    return {
      rsvps: rows.map((r) => {
        const ev = byId.get(r.event_id);
        return {
          ...r,
          event_name: ev?.name,
          event_start_date: ev?.start_date,
          event_city: ev?.city,
          event_cover_url: ev?.cover_url,
          type: 'rsvp',
        };
      }),
    };
  }

  async create(userId: string, eventId: unknown) {
    if (!eventId) throw new BadRequestException('Event ID required.');
    if (!isUuid(eventId)) throw new NotFoundException('Event not found.');
    const ev = await this.prisma.events.findUnique({
      where: { id: eventId },
      select: { id: true, name: true, city: true, start_date: true, max_capacity: true, status: true, end_date: true, sales_cutoff: true },
    });
    if (!ev || ev.status !== 'published') throw new NotFoundException('Event not found.');
    const cutoff = ev.sales_cutoff || ev.end_date;
    if (cutoff && new Date() > cutoff) throw new BadRequestException('RSVPs for this event are now closed.');
    const key = { event_id_user_id: { event_id: eventId, user_id: userId } };
    const { existed, rsvp } = await this.prisma.$transaction(async (tx) => {
      // Lock the event row so two people can't both take the last spot
      await tx.$queryRaw`select id from events where id = ${eventId}::uuid for update`;
      const prev = await tx.rsvps.findUnique({ where: key, select: { status: true } });
      if (ev.max_capacity && prev?.status !== 'confirmed') {
        const count = await tx.rsvps.count({ where: { event_id: eventId, status: 'confirmed' } });
        if (count >= ev.max_capacity) throw new BadRequestException('Event is at full capacity.');
      }
      const row = await tx.rsvps.upsert({
        where: key,
        create: { event_id: eventId, user_id: userId, status: 'confirmed' },
        update: { status: 'confirmed' },
      });
      return { existed: !!prev, rsvp: row };
    });
    // The dropped rsvps_notify_friends trigger ran after INSERT only (not when an RSVP was re-confirmed)
    if (!existed) void this.notifyFriends(ev, userId);
    return { success: true, rsvp };
  }

  async cancel(eventId: string, userId: string) {
    if (isUuid(eventId)) {
      await this.prisma.rsvps.updateMany({ where: { event_id: eventId, user_id: userId }, data: { status: 'cancelled' } });
    }
    return { success: true };
  }

  /**
   * Port of notify_friends_of_rsvp(): mutual followers in the same city (or either city unknown) hear that a friend
   * is going to an upcoming published event, at most one friend_rsvp notification per person per day.
   */
  async notifyFriends(ev: { id: string; name: string; city: string | null; start_date: Date | null }, userId: string) {
    try {
      if (ev.start_date && ev.start_date < new Date()) return;
      const [actor, friends] = await Promise.all([
        this.prisma.profiles.findUnique({ where: { id: userId }, select: { full_name: true } }),
        this.prisma.$queryRaw<{ id: string }[]>`
          select f.follower_id as id
            from public.user_follows f
            join public.user_follows back on back.follower_id = ${userId}::uuid and back.following_id = f.follower_id
            join public.profiles fp on fp.id = f.follower_id
           where f.following_id = ${userId}::uuid
             and (${ev.city}::text is null or fp.city is null or lower(fp.city) = lower(${ev.city}::text))
             and not exists (
               select 1 from public.notifications n
                where n.user_id = f.follower_id and n.type = 'friend_rsvp' and n.created_at > now() - interval '1 day'
             )`,
      ]);
      const title = `${actor?.full_name || 'A friend'} is going to ${ev.name}`;
      for (const f of friends) {
        await this.notifications.create(f.id, 'friend_rsvp', title, 'Tap to see the event and join them.', {
          eventId: ev.id,
          friendId: userId,
        });
      }
    } catch (e) {
      this.log.error(`friend_rsvp notifications failed: ${(e as Error).message}`);
    }
  }
}
