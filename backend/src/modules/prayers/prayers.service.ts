import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { isAdmin, OK } from '../reports/is-admin';

export const PRAYER_FILTERS = ['all', 'answered', 'mine', 'friends', 'church'];

@Injectable()
export class PrayersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** get_prayer_wall(): author fields are null on other people's anonymous prayers; blocked authors are hidden. */
  wall(uid: string, filter: string, limit: number, before: Date | null) {
    return this.prisma.$queryRaw`
      with me as (select ${uid}::uuid as uid),
      home as (select home_church_id from public.user_settings where user_id = ${uid}::uuid)
      select p.id, p.body, p.is_anonymous, p.created_at, p.answered_at, p.testimony, p.prayed_count,
             exists (select 1 from public.prayer_prays pp where pp.prayer_id = p.id and pp.user_id = (select uid from me)) as has_prayed,
             p.author_id = (select uid from me) as is_mine,
             public.are_friends(p.author_id, (select uid from me)) as is_friend,
             p.church_id,
             case when p.is_anonymous and p.author_id <> (select uid from me) then null else p.author_id end as author_id,
             case when p.is_anonymous and p.author_id <> (select uid from me) then null else pr.full_name end as author_name,
             case when p.is_anonymous and p.author_id <> (select uid from me) then null else pr.avatar_url end as author_avatar_url,
             case when p.is_anonymous and p.author_id <> (select uid from me) then null else pr.avatar_color end as author_avatar_color
        from public.prayers p
        join public.profiles pr on pr.id = p.author_id
       where not p.hidden
         and (${before}::timestamptz is null or p.created_at < ${before}::timestamptz)
         and not exists (select 1 from public.blocks b where b.blocker_id = (select uid from me) and b.blocked_id = p.author_id)
         and (
           ${filter}::text = 'all'
           or (${filter}::text = 'answered' and p.answered_at is not null)
           or (${filter}::text = 'mine' and p.author_id = (select uid from me))
           or (${filter}::text = 'friends' and not p.is_anonymous and public.are_friends(p.author_id, (select uid from me)))
           or (${filter}::text = 'church' and p.church_id is not null and p.church_id = (select home_church_id from home))
         )
       order by p.created_at desc
       limit ${limit}::int`;
  }

  async create(uid: string, body: string, isAnonymous: boolean, churchId: string | null) {
    const text = body.trim();
    if (text.length < 3 || text.length > 1000) throw new BadRequestException('Prayer must be 3 to 1000 characters.');
    if (churchId && !(await this.prisma.churches.findUnique({ where: { id: churchId }, select: { id: true } }))) {
      throw new NotFoundException('Church not found.');
    }
    return this.prisma.prayers.create({ data: { author_id: uid, body: text, is_anonymous: isAnonymous, church_id: churchId } });
  }

  /** Author or admin. */
  async remove(uid: string, id: string) {
    const p = await this.prisma.prayers.findUnique({ where: { id }, select: { author_id: true } });
    if (!p) throw new NotFoundException('Prayer not found.');
    if (p.author_id !== uid && !(await isAdmin(this.prisma, uid))) throw new ForbiddenException('You can only delete your own prayers.');
    await this.prisma.prayers.delete({ where: { id } });
    return OK;
  }

  /** pray_for(): one prayer per person; the count only goes up the first time. */
  async prayFor(uid: string, id: string): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const p = await tx.prayers.findUnique({ where: { id }, select: { prayed_count: true } });
      if (!p) throw new NotFoundException('Prayer not found.');
      const added = await tx.$executeRaw`
        insert into public.prayer_prays (prayer_id, user_id) values (${id}::uuid, ${uid}::uuid) on conflict do nothing`;
      if (!added) return p.prayed_count;
      const updated = await tx.prayers.update({ where: { id }, data: { prayed_count: { increment: 1 } }, select: { prayed_count: true } });
      return updated.prayed_count;
    });
  }

  /** mark_prayer_answered(): author only, idempotent; creates the 'answered' community post and notifies everyone who prayed. */
  async markAnswered(uid: string, id: string, testimony: string | undefined): Promise<string> {
    const result = await this.prisma.$transaction(async (tx) => {
      const [p] = await tx.$queryRaw<{ author_id: string; is_anonymous: boolean; answered_at: Date | null; testimony_post_id: string | null }[]>`
        select author_id, is_anonymous, answered_at, testimony_post_id from public.prayers where id = ${id}::uuid for update`;
      if (!p || p.author_id !== uid) throw new ForbiddenException('Only the author can mark this prayer answered');
      if (p.answered_at) return { postId: p.testimony_post_id, notify: null };
      const text = (testimony ?? '').trim();
      if (text.length < 3) throw new BadRequestException('Share a short testimony');
      if (text.length > 2000) throw new BadRequestException('Testimony must be 2000 characters or fewer.');
      const post = await tx.community_posts.create({ data: { author_id: uid, body: text, post_type: 'answered', prayer_id: id }, select: { id: true } });
      await tx.prayers.update({ where: { id }, data: { answered_at: new Date(), testimony: text, testimony_post_id: post.id } });
      const author = await tx.profiles.findUnique({ where: { id: uid }, select: { full_name: true } });
      const prayed = await tx.prayer_prays.findMany({ where: { prayer_id: id, user_id: { not: uid } }, select: { user_id: true } });
      const name = p.is_anonymous ? 'Someone you prayed for' : author?.full_name || 'Someone';
      return { postId: post.id, notify: { name, userIds: prayed.map((r) => r.user_id) } };
    });
    if (result.notify) {
      for (const userId of result.notify.userIds) {
        await this.notifications.create(userId, 'prayer_answered', 'A prayer you prayed for was answered',
          `${result.notify.name} shared how God answered their prayer.`, { prayerId: id, postId: result.postId });
      }
    }
    return result.postId;
  }

}

/** queue_prayer_summaries(): one "N people prayed for you today" per author (last 24 h, excluding self). */
export async function queuePrayerSummaries(prisma: PrismaService, notifications: NotificationsService) {
  const rows = await prisma.$queryRaw<{ author_id: string; n: number }[]>`
    select p.author_id, count(*)::int as n
      from public.prayer_prays pp
      join public.prayers p on p.id = pp.prayer_id
     where pp.created_at > now() - interval '24 hours' and pp.user_id <> p.author_id
     group by p.author_id`;
  for (const r of rows) {
    await notifications.create(r.author_id, 'prayer_summary',
      `${r.n} ${r.n === 1 ? 'person prayed' : 'people prayed'} for you today`, 'Your community is standing with you.', { count: r.n });
  }
  return rows.length;
}
