import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AUTHOR_SELECT, clampInt, isUuid, prismaCode, sanitizeText } from '../community/text';

const ROLES = ['attendee', 'host', 'admin'];

/** Activity feed row text, same wording as server.js. Exported for the unit test. */
export function ticketActivityText(name: string | null | undefined, qty: number, eventName: string | null | undefined) {
  return `${name || 'Attendee'} bought ${qty} ticket${qty !== 1 ? 's' : ''} for "${eventName}"`;
}

/**
 * The dropped admin_* views as queries. Counts are cast to int and sums to float8 so they serialise as JSON numbers
 * (PostgREST did the same); days are `YYYY-MM-DD` text like PostgREST's date output.
 */
@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
  ) {}

  async overview() {
    const [row] = await this.prisma.$queryRaw<Record<string, number>[]>`
      select (select count(*)::int from profiles) as total_users,
             (select count(*)::int from events where status = 'published') as published_events,
             (select count(*)::int from events) as total_events,
             (select coalesce(sum(total_charged_cents), 0)::float8 from tickets where status = 'confirmed') as total_revenue_cents,
             (select count(*)::int from tickets where status = 'confirmed') as total_tickets_sold,
             (select count(*)::int from rsvps where status = 'confirmed') as total_rsvps`;
    return row;
  }

  async signups() {
    const data = await this.prisma.$queryRaw`
      select date_trunc('day', created_at)::date::text as day, count(*)::int as signups
      from profiles group by 1 order by 1 desc`;
    return { data };
  }

  async revenue() {
    const data = await this.prisma.$queryRaw`
      select date_trunc('day', created_at)::date::text as day, count(*)::int as tickets_sold,
             sum(total_charged_cents)::float8 as revenue_cents, sum(platform_fee_cents)::float8 as platform_fee_cents
      from tickets where status = 'confirmed' group by 1 order by 1 desc`;
    return { data };
  }

  async eventsByType() {
    const data = await this.prisma.$queryRaw`
      select event_type, count(*)::int as total, (count(*) filter (where status = 'published'))::int as published
      from events group by event_type order by count(*) desc`;
    return { data };
  }

  async topEvents() {
    const events = await this.prisma.$queryRaw`
      select e.id, e.name, e.city, e.state, e.start_date,
             (count(t.id) filter (where t.status = 'confirmed'))::int as tickets_sold,
             coalesce(sum(t.total_charged_cents) filter (where t.status = 'confirmed'), 0)::float8 as revenue_cents
      from events e left join tickets t on t.event_id = e.id
      group by e.id order by count(t.id) filter (where t.status = 'confirmed') desc limit 50`;
    return { events };
  }

  async topHosts() {
    const hosts = await this.prisma.$queryRaw`
      select p.id, p.full_name, p.email, count(distinct e.id)::int as events_created,
             (count(t.id) filter (where t.status = 'confirmed'))::int as tickets_sold,
             coalesce(sum(t.host_receives_cents) filter (where t.status = 'confirmed'), 0)::float8 as host_revenue_cents
      from profiles p left join events e on e.host_id = p.id left join tickets t on t.event_id = e.id
      group by p.id order by count(t.id) filter (where t.status = 'confirmed') desc limit 50`;
    return { hosts };
  }

  async activity() {
    const [users, events, tickets] = await Promise.all([
      this.prisma.profiles.findMany({
        select: { id: true, full_name: true, email: true, created_at: true, role: true },
        orderBy: { created_at: 'desc' },
        take: 10,
      }),
      this.prisma.events.findMany({
        select: { id: true, name: true, status: true, created_at: true, host_id: true, profiles: { select: { full_name: true } } },
        orderBy: { created_at: 'desc' },
        take: 10,
      }),
      this.prisma.tickets.findMany({
        where: { status: 'confirmed' },
        select: {
          id: true, quantity: true, total_charged_cents: true, confirmed_at: true,
          events: { select: { name: true } }, profiles: { select: { full_name: true } },
        },
        orderBy: { confirmed_at: 'desc' },
        take: 10,
      }),
    ]);
    const activity = [
      ...users.map((u) => ({
        type: 'signup', time: u.created_at,
        text: `${u.full_name || u.email} joined ChristLink`,
        icon: '👤', color: '#4EC98C',
      })),
      ...events.map((e) => ({
        type: 'event', time: e.created_at,
        text: `${e.profiles?.full_name || 'Host'} created "${e.name}"`,
        icon: '✝', color: '#C9A84C', sub: e.status,
      })),
      ...tickets.map((t) => ({
        type: 'ticket', time: t.confirmed_at,
        text: ticketActivityText(t.profiles?.full_name, t.quantity, t.events?.name),
        icon: '🎟️', color: '#A882FF',
        sub: `$${((t.total_charged_cents || 0) / 100).toFixed(2)}`,
      })),
    ]
      .sort((a, b) => new Date(b.time ?? 0).getTime() - new Date(a.time ?? 0).getTime())
      .slice(0, 20);
    return { activity };
  }

  async users(q: unknown, role: unknown, limitQ: unknown, offsetQ: unknown) {
    const term = typeof q === 'string' ? q.trim() : '';
    const rows = await this.prisma.profiles.findMany({
      where: {
        ...(term ? { OR: [{ full_name: { contains: term, mode: 'insensitive' } }, { email: { contains: term, mode: 'insensitive' } }] } : {}),
        ...(typeof role === 'string' && role ? { role } : {}),
      },
      select: {
        id: true, full_name: true, email: true, role: true, city: true, created_at: true, avatar_url: true, avatar_color: true,
        host_stripe_accounts: { select: { stripe_account_id: true } },
      },
      orderBy: { created_at: 'desc' },
      skip: clampInt(offsetQ, 0, 0, Number.MAX_SAFE_INTEGER),
      take: clampInt(limitQ, 30, 1, 200),
    });
    const users = rows.map(({ host_stripe_accounts, ...u }) => ({
      ...u,
      stripe_account_id: host_stripe_accounts?.stripe_account_id || null,
    }));
    return { users };
  }

  async setRole(adminId: string, id: string, role: unknown) {
    if (typeof role !== 'string' || !ROLES.includes(role)) throw new BadRequestException('Invalid role.');
    if (id === adminId && role !== 'admin') throw new BadRequestException('Cannot change your own admin role.');
    if (isUuid(id)) await this.prisma.profiles.updateMany({ where: { id }, data: { role } });
    return { success: true };
  }

  async cancelEvent(id: string) {
    if (!isUuid(id)) throw new NotFoundException('Event not found.');
    await this.prisma.events.updateMany({ where: { id }, data: { status: 'cancelled' } });
    return { success: true };
  }

  async deleteEvent(id: string) {
    if (!isUuid(id)) throw new NotFoundException('Event not found.');
    await this.prisma.events.deleteMany({ where: { id } });
    return { success: true };
  }

  async posts(limitQ: unknown, offsetQ: unknown) {
    const posts = await this.prisma.community_posts.findMany({
      include: { profiles: { select: AUTHOR_SELECT } },
      orderBy: { created_at: 'desc' },
      skip: clampInt(offsetQ, 0, 0, Number.MAX_SAFE_INTEGER),
      take: clampInt(limitQ, 50, 1, 200),
    });
    return { posts };
  }

  async deletePost(id: string) {
    if (isUuid(id)) await this.prisma.community_posts.deleteMany({ where: { id } });
    return { success: true };
  }

  async verifications(status: unknown) {
    const rows = await this.prisma.identity_verifications.findMany({
      where: typeof status === 'string' && status ? { status } : undefined,
      include: {
        profiles_identity_verifications_user_idToprofiles: {
          select: { full_name: true, email: true, avatar_url: true, avatar_color: true },
        },
      },
      orderBy: { submitted_at: 'desc' },
    });
    const verifications = rows.map(({ profiles_identity_verifications_user_idToprofiles: profiles, ...v }) => ({ ...v, profiles }));
    return { verifications };
  }

  async approve(adminId: string, userId: string) {
    if (!isUuid(userId)) throw new NotFoundException('Verification not found.');
    const now = new Date();
    const { count } = await this.prisma.identity_verifications.updateMany({
      where: { user_id: userId },
      data: { status: 'verified', verified_at: now, reviewed_by: adminId, rejected_reason: null },
    });
    await this.prisma.profiles.updateMany({ where: { id: userId }, data: { identity_verified: true, identity_verified_at: now } });
    if (count) {
      await this.notify(userId, 'Identity verified', 'Your identity is verified. You can now host paid events.', 'verified');
    }
    return { success: true };
  }

  async reject(adminId: string, userId: string, reason: unknown) {
    if (!isUuid(userId)) throw new NotFoundException('Verification not found.');
    const why = sanitizeText(reason) || 'Verification could not be confirmed.';
    const { count } = await this.prisma.identity_verifications.updateMany({
      where: { user_id: userId },
      data: { status: 'rejected', reviewed_by: adminId, rejected_reason: why },
    });
    await this.prisma.profiles.updateMany({ where: { id: userId }, data: { identity_verified: false, identity_verified_at: null } });
    if (count) await this.notify(userId, 'Identity verification declined', why, 'rejected');
    return { success: true };
  }

  private notify(userId: string, title: string, body: string, status: string) {
    // The decision is saved; a push hiccup must not turn it into an error
    return this.notifications
      .create(userId, 'verification', title, body, { status })
      .catch((e) => this.logger.warn(`verification notification failed: ${(e as Error).message}`));
  }

  async idDocUrl(userId: string) {
    const v = isUuid(userId)
      ? await this.prisma.identity_verifications.findUnique({ where: { user_id: userId }, select: { id_doc_path: true } })
      : null;
    if (!v?.id_doc_path) throw new NotFoundException('No ID document found.');
    // Rows copied from Supabase hold the identity-docs bucket path (`<userId>/id-...`); copy that bucket to private/id-docs/
    const key = v.id_doc_path.startsWith('private/') ? v.id_doc_path : `private/id-docs/${v.id_doc_path}`;
    return { url: await this.storage.signedGetUrl(key, 300) };
  }

  async promoCodes() {
    const rows = await this.prisma.listing_promo_codes.findMany({ orderBy: { created_at: 'desc' } });
    return { codes: rows.map(promoJson) };
  }

  async createPromo(b: Record<string, unknown>) {
    const { code, discount_type, discount_value, max_uses, expires_at } = b ?? {};
    if (!code || !discount_type || !discount_value) {
      throw new BadRequestException('code, discount_type and discount_value are required.');
    }
    if (typeof code !== 'string' || !code.trim()) throw new BadRequestException('code, discount_type and discount_value are required.');
    if (discount_type !== 'percent' && discount_type !== 'fixed') {
      throw new BadRequestException('discount_type must be percent or fixed.');
    }
    const val = parseFloat(String(discount_value));
    if (isNaN(val) || val <= 0) throw new BadRequestException('discount_value must be a positive number.');
    if (discount_type === 'percent' && val > 100) throw new BadRequestException('Percent discount cannot exceed 100.');
    const maxUses = max_uses ? parseInt(String(max_uses), 10) : null;
    if (maxUses !== null && (isNaN(maxUses) || maxUses < 1)) throw new BadRequestException('max_uses must be a positive number.');
    const expires = expires_at ? new Date(String(expires_at)) : null;
    if (expires && isNaN(expires.getTime())) throw new BadRequestException('expires_at must be a date.');
    try {
      const row = await this.prisma.listing_promo_codes.create({
        data: { code: code.toUpperCase().trim(), discount_type, discount_value: val, max_uses: maxUses, expires_at: expires },
      });
      return { code: promoJson(row) };
    } catch (e) {
      if (prismaCode(e) === 'P2002') throw new BadRequestException('A promo code with that code already exists.');
      throw e;
    }
  }

  async setPromoActive(id: string, active: unknown) {
    if (typeof active !== 'boolean') throw new BadRequestException('active must be true or false.');
    if (isUuid(id)) await this.prisma.listing_promo_codes.updateMany({ where: { id }, data: { active } });
    return { success: true };
  }

  /** server.js only deletes the row; the Stripe account itself is left alone. */
  async disconnectStripe(userId: string) {
    if (isUuid(userId)) await this.prisma.host_stripe_accounts.deleteMany({ where: { user_id: userId } });
    return { success: true };
  }
}

/** numeric comes out of Prisma as a Decimal (JSON string); PostgREST sent a number. */
function promoJson<T extends { discount_value: unknown }>(row: T) {
  return { ...row, discount_value: Number(row.discount_value) };
}
