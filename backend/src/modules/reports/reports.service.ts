import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OK } from './is-admin';

export const REPORT_TARGETS = ['post', 'reply', 'forum_message', 'prayer', 'profile', 'event', 'church'] as const;
export const REPORT_REASONS = ['spam', 'harassment', 'hate', 'sexual', 'violence', 'scam', 'false_info', 'other'] as const;

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** A second report of the same target by the same person is a quiet success (unique reporter/target). */
  async report(uid: string, b: { target_type: string; target_id: string; reason: string; details?: string | null }) {
    await this.prisma.reports.createMany({
      data: [{ reporter_id: uid, target_type: b.target_type, target_id: b.target_id, reason: b.reason, details: b.details?.trim() || null }],
      skipDuplicates: true,
    });
    return OK;
  }

  async blockedIds(uid: string): Promise<string[]> {
    const rows = await this.prisma.blocks.findMany({ where: { blocker_id: uid }, select: { blocked_id: true } });
    return rows.map((r) => r.blocked_id);
  }

  async block(uid: string, userId: string) {
    if (userId === uid) throw new BadRequestException('You cannot block yourself.');
    if (!(await this.prisma.profiles.findUnique({ where: { id: userId }, select: { id: true } }))) {
      throw new NotFoundException('User not found.');
    }
    await this.prisma.blocks.createMany({ data: [{ blocker_id: uid, blocked_id: userId }], skipDuplicates: true });
    return OK;
  }

  async unblock(uid: string, userId: string) {
    await this.prisma.blocks.deleteMany({ where: { blocker_id: uid, blocked_id: userId } });
    return OK;
  }

  /** admin_report_queue(): open reports, oldest first, with per-target count, preview and reporter name. */
  queue() {
    return this.prisma.$queryRaw`
      select r.id, r.target_type, r.target_id, r.reason, r.details, r.created_at,
             (select count(*)::int from public.reports x
               where x.target_type = r.target_type and x.target_id = r.target_id and x.status = 'open') as report_count,
             left(coalesce(
               case r.target_type
                 when 'prayer' then (select body from public.prayers where id = r.target_id)
                 when 'post' then (select body from public.community_posts where id = r.target_id)
                 when 'reply' then (select body from public.community_replies where id = r.target_id)
                 when 'forum_message' then (select content from public.event_forum_posts where id = r.target_id)
                 when 'profile' then (select full_name || ' — ' || coalesce(bio, '') from public.profiles where id = r.target_id)
                 when 'event' then (select name from public.events where id = r.target_id)
                 when 'church' then (select name from public.churches where id = r.target_id)
               end, '[removed]'), 240) as preview,
             (select full_name from public.profiles where id = r.reporter_id) as reporter_name
        from public.reports r
       where r.status = 'open'
       order by r.created_at asc`;
  }

  /** resolve_report(): 'remove' takes the target down; every open report on that target is closed. */
  async resolve(adminId: string, reportId: string, action: 'dismiss' | 'remove') {
    const r = await this.prisma.reports.findUnique({ where: { id: reportId } });
    if (!r) throw new NotFoundException('Report not found.');
    await this.prisma.$transaction(async (tx) => {
      if (action === 'remove') {
        const id = r.target_id;
        switch (r.target_type) {
          case 'prayer': await tx.prayers.updateMany({ where: { id }, data: { hidden: true } }); break;
          case 'post': await tx.community_posts.deleteMany({ where: { id } }); break;
          case 'reply': await tx.community_replies.deleteMany({ where: { id } }); break;
          case 'forum_message': await tx.event_forum_posts.deleteMany({ where: { id } }); break;
          case 'church': await tx.churches.updateMany({ where: { id }, data: { hidden: true } }); break;
          case 'event': await tx.events.updateMany({ where: { id }, data: { status: 'cancelled' } }); break;
        }
      }
      await tx.reports.updateMany({
        where: { target_type: r.target_type, target_id: r.target_id, status: 'open' },
        data: { status: action === 'remove' ? 'actioned' : 'dismissed', resolved_by: adminId, resolved_at: new Date() },
      });
    });
    return OK;
  }
}
