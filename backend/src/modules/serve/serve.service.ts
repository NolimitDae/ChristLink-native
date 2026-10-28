import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { isAdmin, OK } from '../reports/is-admin';
import type { RoleDto } from './serve.controller';

const TAKEN = ['signed_up', 'checked_in', 'completed'];

@Injectable()
export class ServeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** The shift's role name when the caller created the role (or is an admin and `allowAdmin`), else null. */
  private async organizerRole(uid: string, shiftId: string, allowAdmin: boolean) {
    const s = await this.prisma.serve_shifts.findUnique({ where: { id: shiftId }, select: { serve_roles: { select: { name: true, created_by: true } } } });
    if (!s) return null;
    if (s.serve_roles.created_by === uid || (allowAdmin && (await isAdmin(this.prisma, uid)))) return s.serve_roles.name;
    return null;
  }

  /** open_serve_shifts(): upcoming shifts (published event or no event), taken count and the caller's sign-up. */
  openShifts(uid: string | null, churchId: string | null, eventId: string | null) {
    return this.prisma.$queryRaw`
      select sh.id as shift_id, r.id as role_id, r.name as role_name, r.description, r.requirements,
             sh.starts_at, sh.ends_at, sh.spots,
             (select count(*)::int from public.serve_signups x
               where x.shift_id = sh.id and x.status in ('signed_up', 'checked_in', 'completed')) as taken,
             r.event_id, e.name as event_name, r.church_id, c.name as church_name,
             mine.id as my_signup_id, mine.status as my_status, mine.code as my_code
        from public.serve_shifts sh
        join public.serve_roles r on r.id = sh.role_id
        left join public.events e on e.id = r.event_id
        left join public.churches c on c.id = r.church_id
        left join public.serve_signups mine on mine.shift_id = sh.id and mine.user_id = ${uid}::uuid
       where sh.starts_at > now()
         and (${churchId}::uuid is null or r.church_id = ${churchId}::uuid)
         and (${eventId}::uuid is null or r.event_id = ${eventId}::uuid)
         and (e.id is null or e.status = 'published')
       order by sh.starts_at
       limit 100`;
  }

  /**
   * Sign-up with serve_signup_guard's rules: the shift row is locked, started or full shifts are rejected, and a
   * cancelled sign-up is re-joined (same code). Already signed up returns the existing pass.
   */
  async signup(uid: string, shiftId: string): Promise<{ id: string; code: string }> {
    return this.prisma.$transaction(async (tx) => {
      const [shift] = await tx.$queryRaw<{ starts_at: Date; spots: number }[]>`
        select starts_at, spots from public.serve_shifts where id = ${shiftId}::uuid for update`;
      if (!shift) throw new NotFoundException('Shift not found');
      const existing = await tx.serve_signups.findUnique({ where: { shift_id_user_id: { shift_id: shiftId, user_id: uid } } });
      if (existing?.status === 'signed_up') return { id: existing.id, code: existing.code };
      if (existing && existing.status !== 'cancelled') throw new BadRequestException('Not allowed');
      if (shift.starts_at < new Date()) throw new BadRequestException('This shift has already started');
      const taken = await tx.serve_signups.count({ where: { shift_id: shiftId, status: { in: TAKEN } } });
      if (taken >= shift.spots) throw new BadRequestException('This shift is full');
      const row = existing
        ? await tx.serve_signups.update({ where: { id: existing.id }, data: { status: 'signed_up' } })
        : await tx.serve_signups.create({ data: { shift_id: shiftId, user_id: uid } });
      return { id: row.id, code: row.code };
    });
  }

  /** Own sign-up only; only signed_up → cancelled. */
  async cancel(uid: string, signupId: string) {
    const s = await this.prisma.serve_signups.findUnique({ where: { id: signupId } });
    if (!s || s.user_id !== uid) throw new NotFoundException('Sign-up not found.');
    if (s.status === 'cancelled') return OK;
    if (s.status !== 'signed_up') throw new BadRequestException('Not allowed');
    await this.prisma.serve_signups.update({ where: { id: signupId }, data: { status: 'cancelled' } });
    return OK;
  }

  /** serve_roles_insert policy: host of the event, or owner (claimed_by) of the church. */
  async createRole(uid: string, b: RoleDto): Promise<{ id: string }> {
    if (!b.event_id && !b.church_id) throw new BadRequestException('Choose an event or a church.');
    const [event, church] = await Promise.all([
      b.event_id ? this.prisma.events.findUnique({ where: { id: b.event_id }, select: { host_id: true } }) : null,
      b.church_id ? this.prisma.churches.findUnique({ where: { id: b.church_id }, select: { claimed_by: true } }) : null,
    ]);
    if ((b.event_id && !event) || (b.church_id && !church)) throw new NotFoundException('Event or church not found.');
    if (event?.host_id !== uid && church?.claimed_by !== uid) {
      throw new ForbiddenException('Only the event host or church owner can add volunteer roles.');
    }
    const shifts = (b.shifts ?? []).map((s) => ({ starts_at: new Date(s.starts_at), ends_at: new Date(s.ends_at), spots: s.spots }));
    if (shifts.some((s) => s.ends_at <= s.starts_at)) throw new BadRequestException('A shift must end after it starts.');
    return this.prisma.$transaction(async (tx) => {
      const role = await tx.serve_roles.create({
        data: {
          event_id: b.event_id ?? null, church_id: b.church_id ?? null, name: b.name.trim(),
          description: b.description ?? null, requirements: b.requirements ?? null, created_by: uid,
        },
        select: { id: true },
      });
      if (shifts.length) await tx.serve_shifts.createMany({ data: shifts.map((s) => ({ ...s, role_id: role.id })) });
      return { id: role.id };
    });
  }

  myShifts(uid: string) {
    return this.prisma.serve_shifts.findMany({
      where: { serve_roles: { created_by: uid } },
      orderBy: { starts_at: 'asc' },
      include: { serve_roles: { select: { name: true, event_id: true, church_id: true } } },
    });
  }

  /** Organizer only (serve_signups_select policy); includes each volunteer's name. */
  async roster(uid: string, shiftId: string) {
    if (!(await this.organizerRole(uid, shiftId, false))) throw new ForbiddenException('Only the organizer can see this roster.');
    return this.prisma.serve_signups.findMany({
      where: { shift_id: shiftId, status: { not: 'cancelled' } },
      orderBy: { created_at: 'asc' },
      include: { profiles: { select: { id: true, full_name: true, avatar_url: true, avatar_color: true } } },
    });
  }

  /** serve_check_in(): organizer/admin; answers { valid, message } or { valid: false, error }. */
  async checkIn(uid: string, code: string) {
    const admin = await isAdmin(this.prisma, uid);
    const su = await this.prisma.serve_signups.findFirst({
      where: { code: code.trim().toUpperCase(), ...(admin ? {} : { serve_shifts: { serve_roles: { created_by: uid } } }) },
      include: { profiles: { select: { full_name: true } }, serve_shifts: { select: { serve_roles: { select: { name: true } } } } },
    });
    if (!su) return { valid: false, error: 'This volunteer pass is not for one of your shifts.' };
    if (su.status === 'cancelled') return { valid: false, error: 'This sign-up was cancelled.' };
    if (su.status === 'checked_in' || su.status === 'completed') return { valid: false, error: 'Already checked in.' };
    await this.prisma.serve_signups.update({ where: { id: su.id }, data: { status: 'checked_in', checked_in_at: new Date() } });
    return { valid: true, message: `${su.profiles.full_name || 'Volunteer'} checked in · ${su.serve_shifts.serve_roles.name}` };
  }

  /** complete_serve_shift(): checked_in → completed, signed_up → no_show; returns the completed count. */
  async complete(uid: string, shiftId: string): Promise<number> {
    if (!(await this.organizerRole(uid, shiftId, true))) throw new ForbiddenException('Only the organizer can complete this shift');
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.serve_shifts.update({ where: { id: shiftId }, data: { completed_at: now } });
      const { count } = await tx.serve_signups.updateMany({ where: { shift_id: shiftId, status: 'checked_in' }, data: { status: 'completed', completed_at: now } });
      await tx.serve_signups.updateMany({ where: { shift_id: shiftId, status: 'signed_up' }, data: { status: 'no_show' } });
      return count;
    });
  }

  /** message_volunteers(): a serve_message notification to every active volunteer; returns how many. */
  async message(uid: string, shiftId: string, message: string | undefined): Promise<number> {
    const roleName = await this.organizerRole(uid, shiftId, true);
    if (!roleName) throw new ForbiddenException('Only the organizer can message this shift');
    const text = (message ?? '').trim();
    if (text.length < 2) throw new BadRequestException('Message is empty');
    const volunteers = await this.prisma.serve_signups.findMany({
      where: { shift_id: shiftId, status: { in: ['signed_up', 'checked_in'] } },
      select: { user_id: true },
    });
    for (const v of volunteers) {
      await this.notifications.create(v.user_id, 'serve_message', `Message about your ${roleName} shift`, text.slice(0, 500), { shiftId });
    }
    return volunteers.length;
  }

  /** my_hours_served(): completed shift hours, 1 decimal. */
  async hours(uid: string): Promise<number> {
    const [r] = await this.prisma.$queryRaw<{ hours: number }[]>`
      select coalesce(round(sum(extract(epoch from (sh.ends_at - sh.starts_at)) / 3600.0)::numeric, 1), 0)::float8 as hours
        from public.serve_signups su join public.serve_shifts sh on sh.id = su.shift_id
       where su.user_id = ${uid}::uuid and su.status = 'completed'`;
    return r.hours;
  }
}
