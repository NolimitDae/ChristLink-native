import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { isAdmin, OK } from '../reports/is-admin';
import type { ChurchDto } from './churches.controller';
import { RecurringInput, recurringOut, toRecurringData } from './recurring';

export const VISIT_WINDOW_DAYS = 60;

/** "Sun, Nov 8, 9:00 AM" in the church owner's time zone (UTC, labelled, when unknown or invalid). */
export function visitWhen(at: Date, timezone: string | null | undefined): string {
  const opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };
  try {
    if (timezone) return at.toLocaleString('en-US', { ...opts, timeZone: timezone });
  } catch {
    // fall through to UTC
  }
  return `${at.toLocaleString('en-US', { ...opts, timeZone: 'UTC' })} UTC`;
}

@Injectable()
export class ChurchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** churches_select policy: hidden churches only for their owner and admins. */
  private async visible(uid: string | undefined) {
    if (await isAdmin(this.prisma, uid)) return {};
    return uid ? { OR: [{ hidden: false }, { claimed_by: uid }] } : { hidden: false };
  }

  /** Owner (claimed_by) or admin, else 403; 404 when missing. Returns whether the caller is an admin. */
  private async assertManager(uid: string, churchId: string) {
    const c = await this.prisma.churches.findUnique({ where: { id: churchId }, select: { claimed_by: true } });
    if (!c) throw new NotFoundException('Church not found.');
    const admin = await isAdmin(this.prisma, uid);
    if (c.claimed_by !== uid && !admin) throw new ForbiddenException('Only the church owner can do this.');
    return admin;
  }

  async search(uid: string | undefined, q: string, limit: number) {
    const term = q.trim().replace(/[%_\\,()]/g, '');
    const match = term
      ? { OR: [{ name: { contains: term, mode: 'insensitive' as const } }, { city: { contains: term, mode: 'insensitive' as const } }] }
      : {};
    return this.prisma.churches.findMany({
      where: { AND: [await this.visible(uid), match] },
      orderBy: [{ verified: 'desc' }, { name: 'asc' }],
      take: limit,
    });
  }

  async get(uid: string | undefined, id: string) {
    return this.prisma.churches.findFirst({ where: { AND: [{ id }, await this.visible(uid)] } });
  }

  mine(uid: string) {
    return this.prisma.churches.findMany({ where: { claimed_by: uid }, orderBy: { name: 'asc' } });
  }

  /**
   * churches_guard on insert: non-admins get verified=false, hidden=false and own the church — unless `as_member`:
   * then nobody owns it (leaders can claim it later), and the same name in the same city returns the existing church
   * instead of a duplicate.
   */
  async create(uid: string, b: ChurchDto) {
    if (!b.name) throw new BadRequestException('Church name is required.');
    const { verified, hidden, as_member: asMember, ...fields } = b;
    if (asMember) {
      if (!fields.city?.trim()) throw new BadRequestException('City is required.');
      const existing = await this.prisma.churches.findFirst({
        where: {
          hidden: false,
          name: { equals: fields.name.trim(), mode: 'insensitive' },
          city: { equals: fields.city.trim(), mode: 'insensitive' },
        },
      });
      if (existing) return existing;
    }
    const admin = await isAdmin(this.prisma, uid);
    return this.prisma.churches.create({
      data: {
        ...fields,
        name: fields.name.trim(),
        created_by: uid,
        claimed_by: admin || asMember ? null : uid,
        verified: admin ? verified ?? false : false,
        hidden: admin ? hidden ?? false : false,
      },
    });
  }

  /** churches_guard on update: verified/hidden only change for admins; claimed_by/created_by never through this route. */
  async update(uid: string, id: string, b: ChurchDto) {
    const admin = await this.assertManager(uid, id);
    const { verified, hidden, ...fields } = b;
    return this.prisma.churches.update({
      where: { id },
      data: { ...fields, name: fields.name?.trim(), ...(admin ? { verified, hidden } : {}) },
    });
  }

  async claim(uid: string, churchId: string, roleAtChurch: string | null, note: string | null) {
    if (!(await this.get(uid, churchId))) throw new NotFoundException('Church not found.');
    await this.prisma.church_claims.createMany({
      data: [{ church_id: churchId, user_id: uid, role_at_church: roleAtChurch, note }],
      skipDuplicates: true,
    });
    return OK;
  }

  pendingClaims() {
    return this.prisma.church_claims.findMany({
      where: { status: 'pending' },
      orderBy: { created_at: 'asc' },
      include: { churches: { select: { name: true } } },
    });
  }

  /** decide_church_claim(): approving hands the church to the claimant and verifies it; the claimant is notified. */
  async decide(adminId: string, claimId: string, approve: boolean) {
    const claim = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.church_claims.updateMany({
        where: { id: claimId },
        data: { status: approve ? 'approved' : 'rejected', decided_by: adminId, decided_at: new Date() },
      });
      if (!count) throw new NotFoundException('Claim not found');
      const c = await tx.church_claims.findUnique({ where: { id: claimId } });
      if (approve) await tx.churches.update({ where: { id: c.church_id }, data: { claimed_by: c.user_id, verified: true } });
      return c;
    });
    await this.notifications.create(
      claim.user_id,
      'church_claim',
      approve ? 'Church claim approved' : 'Church claim not approved',
      approve ? 'You can now manage your church page.' : 'Reply to support if you think this is a mistake.',
      { churchId: claim.church_id },
    );
    return OK;
  }

  async recurring(churchId: string) {
    const rows = await this.prisma.church_recurring_events.findMany({
      where: { church_id: churchId },
      orderBy: [{ is_service: 'desc' }, { weekday: 'asc' }],
    });
    return rows.map(recurringOut);
  }

  async addRecurring(uid: string, churchId: string, b: RecurringInput) {
    await this.assertManager(uid, churchId);
    const data = toRecurringData(b);
    const row = await this.prisma.church_recurring_events.create({
      data: { ...data, name: data.name, frequency: data.frequency, start_time: data.start_time, church_id: churchId },
    });
    return recurringOut(row);
  }

  async updateRecurring(uid: string, id: string, b: RecurringInput) {
    const existing = await this.prisma.church_recurring_events.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Recurring event not found.');
    await this.assertManager(uid, existing.church_id);
    const row = await this.prisma.church_recurring_events.update({ where: { id }, data: toRecurringData(b, existing) });
    return recurringOut(row);
  }

  async deleteRecurring(uid: string, id: string) {
    const existing = await this.prisma.church_recurring_events.findUnique({ where: { id }, select: { church_id: true } });
    if (!existing) throw new NotFoundException('Recurring event not found.');
    await this.assertManager(uid, existing.church_id);
    await this.prisma.church_recurring_events.delete({ where: { id } });
    return OK;
  }

  async eventIds(churchId: string): Promise<string[]> {
    const rows = await this.prisma.church_events.findMany({ where: { church_id: churchId }, select: { event_id: true } });
    return rows.map((r) => r.event_id);
  }

  /** church_events_insert policy: the caller hosts the event and owns the church (admins included in neither). */
  async linkEvent(uid: string, churchId: string, eventId: string) {
    const [church, event] = await Promise.all([
      this.prisma.churches.findUnique({ where: { id: churchId }, select: { claimed_by: true } }),
      this.prisma.events.findUnique({ where: { id: eventId }, select: { host_id: true } }),
    ]);
    if (!church) throw new NotFoundException('Church not found.');
    if (!event) throw new NotFoundException('Event not found.');
    if (church.claimed_by !== uid || event.host_id !== uid) {
      throw new ForbiddenException('Only the church owner can link their own events.');
    }
    await this.prisma.church_events.createMany({ data: [{ church_id: churchId, event_id: eventId }], skipDuplicates: true });
    return OK;
  }

  async isFollowing(uid: string, churchId: string) {
    const row = await this.prisma.church_follows.findUnique({ where: { church_id_user_id: { church_id: churchId, user_id: uid } } });
    return { following: !!row };
  }

  /**
   * "Plan a visit" connect card. One per person per service time (sending it again updates it). The church owner hears
   * about it; email is shared only when the visitor opts in.
   */
  async planVisit(uid: string, churchId: string, b: { visit_at: string; service_label?: string; party_size?: number; note?: string; share_contact?: boolean }) {
    const church = await this.get(uid, churchId);
    if (!church) throw new NotFoundException('Church not found.');
    const at = new Date(b.visit_at);
    const now = Date.now();
    if (isNaN(at.getTime()) || at.getTime() < now - 3_600_000 || at.getTime() > now + VISIT_WINDOW_DAYS * 86_400_000) {
      throw new BadRequestException(`Pick a service in the next ${VISIT_WINDOW_DAYS} days.`);
    }
    const data = {
      service_label: b.service_label?.trim() || null,
      party_size: b.party_size ?? 1,
      note: b.note?.trim() || null,
      share_contact: !!b.share_contact,
    };
    const key = { church_id_user_id_visit_at: { church_id: churchId, user_id: uid, visit_at: at } };
    const existed = await this.prisma.church_visits.findUnique({ where: key, select: { id: true } });
    const visit = await this.prisma.church_visits.upsert({
      where: key,
      create: { church_id: churchId, user_id: uid, visit_at: at, ...data },
      update: data,
    });
    const ownerId = (church as { claimed_by?: string | null }).claimed_by;
    if (!existed && ownerId && ownerId !== uid) {
      const [who, ownerSettings] = await Promise.all([
        this.prisma.profiles.findUnique({ where: { id: uid }, select: { full_name: true } }),
        this.prisma.user_settings.findUnique({ where: { user_id: ownerId }, select: { timezone: true } }),
      ]);
      const name = who?.full_name?.trim() || 'Someone';
      const party = data.party_size > 1 ? ` (party of ${data.party_size})` : '';
      await this.notifications.create(
        ownerId,
        'church_visit',
        `${name} is planning to visit${party}`,
        `${data.service_label ?? 'Service'} · ${visitWhen(at, ownerSettings?.timezone)}`,
        { churchId, visitId: visit.id },
      );
    }
    return visit;
  }

  async cancelVisit(uid: string, visitId: string) {
    await this.prisma.church_visits.deleteMany({ where: { id: visitId, user_id: uid } });
    return OK;
  }

  /** Owner/admin: upcoming visits (from an hour ago), soonest first. */
  async visits(uid: string, churchId: string) {
    await this.assertManager(uid, churchId);
    const rows = await this.prisma.church_visits.findMany({
      where: { church_id: churchId, visit_at: { gte: new Date(Date.now() - 3_600_000) } },
      orderBy: { visit_at: 'asc' },
      take: 200,
      include: { profiles: { select: { id: true, full_name: true, avatar_url: true, avatar_color: true, email: true } } },
    });
    return rows.map(({ profiles: p, ...v }) => ({
      ...v,
      visitor: { id: p.id, full_name: p.full_name, avatar_url: p.avatar_url, avatar_color: p.avatar_color, email: v.share_contact ? p.email : null },
    }));
  }

  async setFollow(uid: string, churchId: string, follow: boolean) {
    if (follow) {
      if (!(await this.get(uid, churchId))) throw new NotFoundException('Church not found.');
      await this.prisma.church_follows.createMany({ data: [{ church_id: churchId, user_id: uid }], skipDuplicates: true });
    } else {
      await this.prisma.church_follows.deleteMany({ where: { church_id: churchId, user_id: uid } });
    }
    return { following: follow };
  }
}
