import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OK } from '../reports/is-admin';
import type { SettingsDto } from './settings.controller';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  get(uid: string) {
    return this.prisma.user_settings.findUnique({ where: { user_id: uid } });
  }

  async update(uid: string, patch: SettingsDto) {
    const data = { ...patch };
    if (data.home_church_id && !(await this.prisma.churches.findUnique({ where: { id: data.home_church_id }, select: { id: true } }))) {
      throw new NotFoundException('Church not found.');
    }
    return this.prisma.user_settings.upsert({ where: { user_id: uid }, create: { ...data, user_id: uid }, update: data });
  }

  /** A device token belongs to whoever signed in on it last (re-assigned even if another user had it). */
  async savePushToken(uid: string, token: string, platform: string | null) {
    await this.prisma.push_tokens.upsert({
      where: { token },
      create: { token, user_id: uid, platform },
      update: { user_id: uid, platform, updated_at: new Date() },
    });
    return OK;
  }

  async deletePushToken(uid: string, token: string) {
    await this.prisma.push_tokens.deleteMany({ where: { token, user_id: uid } });
    return OK;
  }

  /**
   * Port of delete_my_account(). Ticket and payment rows are kept (their user FKs are ON DELETE SET NULL).
   * Hosts with sales history keep their events (payment records), so their profile is scrubbed instead of deleted.
   */
  async deleteAccount(uid: string) {
    await this.prisma.$transaction(async (tx) => {
      const [{ blocked, has_sales }] = await tx.$queryRaw<{ blocked: boolean; has_sales: boolean }[]>`
        select
          exists (select 1 from public.events e
                   where e.host_id = ${uid}::uuid and e.start_date > now() and e.status = 'published'
                     and exists (select 1 from public.tickets t where t.event_id = e.id and t.status = 'confirmed')) as blocked,
          exists (select 1 from public.events e
                   where e.host_id = ${uid}::uuid
                     and exists (select 1 from public.tickets t where t.event_id = e.id and t.status in ('confirmed', 'refunded'))) as has_sales`;
      if (blocked) {
        throw new BadRequestException('You have upcoming events with sold tickets. Cancel and refund them before deleting your account.');
      }
      if (!has_sales) {
        await tx.event_forum_posts.deleteMany({ where: { user_id: uid } });
        await tx.users.deleteMany({ where: { id: uid } }); // cascades profile, content, tokens, settings
        return;
      }
      const email = `deleted+${uid}@deleted.christlinksocial.com`;
      await tx.events.updateMany({ where: { host_id: uid, start_date: { gt: new Date() } }, data: { status: 'cancelled' } });
      // profiles.email is NOT NULL (the SQL set null), so it gets the same deleted address as the user row
      await tx.profiles.updateMany({
        where: { id: uid },
        data: {
          full_name: 'Deleted host', email, bio: null, city: null, avatar_url: null, banner_url: null, instagram_url: null,
          facebook_url: null, tiktok_url: null, bible_verse: null, bible_verse_reference: null, hot_takes: null, hobbies: null,
          connect_tags: [], prayer_request: null, testimony: null, prayer_supporters: [],
        },
      });
      await tx.community_posts.deleteMany({ where: { author_id: uid } });
      await tx.community_replies.deleteMany({ where: { author_id: uid } });
      await tx.event_forum_posts.deleteMany({ where: { user_id: uid } });
      await tx.prayers.deleteMany({ where: { author_id: uid } });
      await tx.user_follows.deleteMany({ where: { OR: [{ follower_id: uid }, { following_id: uid }] } });
      await tx.push_tokens.deleteMany({ where: { user_id: uid } });
      await tx.user_settings.deleteMany({ where: { user_id: uid } });
      await tx.identity_verifications.deleteMany({ where: { user_id: uid } });
      // Replaces banned_until = infinity: no sessions can be refreshed and the old email no longer maps to this user
      await tx.refresh_tokens.deleteMany({ where: { user_id: uid } });
      await tx.users.update({ where: { id: uid }, data: { email } });
    });
    return OK;
  }
}
