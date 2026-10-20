import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { isAdmin, OK } from '../reports/is-admin';
import type { ChurchDto } from './churches.controller';
import { RecurringInput, recurringOut, toRecurringData } from './recurring';

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

  /** churches_guard on insert: non-admins get verified=false, hidden=false and own the church. */
  async create(uid: string, b: ChurchDto) {
    if (!b.name) throw new BadRequestException('Church name is required.');
    const { verified, hidden, ...fields } = b;
    const admin = await isAdmin(this.prisma, uid);
    return this.prisma.churches.create({
      data: {
        ...fields,
        name: fields.name.trim(),
        created_by: uid,
        claimed_by: admin ? null : uid,
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
