import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AUTHOR_SELECT, clampInt, isUuid, prismaCode, sanitizeText } from './text';

export const POST_TYPES = ['prayer', 'praise', 'testimony', 'encouragement'];
const MAX_POST = 5000;

@Injectable()
export class CommunityService {
  private readonly logger = new Logger(CommunityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Authors the viewer blocked (store rule: blocked users' content is hidden from the blocker). */
  private async blockedIds(viewerId?: string): Promise<string[]> {
    if (!viewerId) return [];
    const rows = await this.prisma.blocks.findMany({ where: { blocker_id: viewerId }, select: { blocked_id: true } });
    return rows.map((r) => r.blocked_id);
  }

  async listPosts(viewerId: string | undefined, limitQ: unknown, offsetQ: unknown) {
    const take = clampInt(limitQ, 30, 1, 100);
    const skip = clampInt(offsetQ, 0, 0, Number.MAX_SAFE_INTEGER);
    const blocked = await this.blockedIds(viewerId);
    const posts = await this.prisma.community_posts.findMany({
      where: blocked.length ? { author_id: { notIn: blocked } } : undefined,
      include: { profiles: { select: AUTHOR_SELECT } },
      orderBy: { created_at: 'desc' },
      skip,
      take,
    });
    const amened = new Set(
      viewerId && posts.length
        ? (
            await this.prisma.community_post_amens.findMany({
              where: { user_id: viewerId, post_id: { in: posts.map((p) => p.id) } },
              select: { post_id: true },
            })
          ).map((a) => a.post_id)
        : [],
    );
    return { posts: posts.map((p) => ({ ...p, has_amened: amened.has(p.id) })) };
  }

  private cleanBody(body: unknown, message: string, max: number, tooLong: string) {
    const safe = sanitizeText(body);
    if (!safe) throw new BadRequestException(message);
    if (safe.length > max) throw new BadRequestException(tooLong);
    return safe;
  }

  async createPost(userId: string, body: unknown) {
    const safe = this.cleanBody(body, 'Post body required.', MAX_POST, `Post must be ${MAX_POST} characters or less.`);
    return this.prisma.community_posts.create({
      data: { author_id: userId, body: safe },
      include: { profiles: { select: AUTHOR_SELECT } },
    });
  }

  private async ownPost(userId: string, postId: string) {
    const post = isUuid(postId)
      ? await this.prisma.community_posts.findUnique({ where: { id: postId }, select: { author_id: true } })
      : null;
    if (!post) throw new NotFoundException('Post not found.');
    if (post.author_id !== userId) throw new ForbiddenException('Not your post.');
  }

  async updatePost(userId: string, postId: string, body: unknown) {
    const safe = this.cleanBody(body, 'Body required.', MAX_POST, `Post must be ${MAX_POST} characters or less.`);
    await this.ownPost(userId, postId);
    return this.prisma.community_posts.update({
      where: { id: postId },
      data: { body: safe },
      include: { profiles: { select: AUTHOR_SELECT } },
    });
  }

  /** Ported set_post_type(): author only, one of POST_TYPES. */
  async setPostType(userId: string, postId: string, type: unknown) {
    if (typeof type !== 'string' || !POST_TYPES.includes(type)) throw new BadRequestException('Unknown post type');
    await this.ownPost(userId, postId);
    await this.prisma.community_posts.update({ where: { id: postId }, data: { post_type: type } });
    return { success: true };
  }

  async deletePost(userId: string, postId: string) {
    await this.ownPost(userId, postId);
    await this.prisma.community_posts.delete({ where: { id: postId } });
    return { ok: true };
  }

  /** Toggle. Delete-first so a double tap can't count twice. `amened` is what the native app reads. */
  async amenPost(userId: string, postId: string) {
    if (!isUuid(postId)) throw new NotFoundException('Post not found.');
    const removed = await this.prisma.community_post_amens.deleteMany({ where: { post_id: postId, user_id: userId } });
    let added = false;
    if (removed.count) {
      await this.prisma.$executeRaw`select adjust_post_amen_count(${postId}::uuid, -1)`;
    } else {
      try {
        const ins = await this.prisma.community_post_amens.createMany({
          data: { post_id: postId, user_id: userId },
          skipDuplicates: true,
        });
        added = ins.count > 0;
      } catch (e) {
        if (prismaCode(e) === 'P2003') throw new NotFoundException('Post not found.');
        throw e;
      }
      if (added) await this.prisma.$executeRaw`select adjust_post_amen_count(${postId}::uuid, 1)`;
    }
    const post = await this.prisma.community_posts.findUnique({ where: { id: postId }, select: { amen_count: true } });
    const has = !removed.count;
    return { amen_count: post?.amen_count ?? 0, has_amened: has, amened: has };
  }

  async listReplies(viewerId: string | undefined, postId: string) {
    if (!isUuid(postId)) return { replies: [] };
    const blocked = await this.blockedIds(viewerId);
    const replies = await this.prisma.community_replies.findMany({
      where: { post_id: postId, ...(blocked.length ? { author_id: { notIn: blocked } } : {}) },
      include: { profiles: { select: AUTHOR_SELECT } },
      orderBy: { created_at: 'asc' },
    });
    const amened = new Set(
      viewerId && replies.length
        ? (
            await this.prisma.community_reply_amens.findMany({
              where: { user_id: viewerId, reply_id: { in: replies.map((r) => r.id) } },
              select: { reply_id: true },
            })
          ).map((a) => a.reply_id)
        : [],
    );
    return { replies: replies.map((r) => ({ ...r, has_amened: amened.has(r.id) })) };
  }

  async createReply(userId: string, postId: string, body: unknown) {
    const safe = this.cleanBody(body, 'Reply body required.', 500, 'Reply must be 500 characters or less.');
    const post = isUuid(postId)
      ? await this.prisma.community_posts.findUnique({ where: { id: postId }, select: { author_id: true } })
      : null;
    if (!post) throw new NotFoundException('Post not found.');

    // server.js called the broken increment_reply_count (event_forum_posts); keep community_posts.reply_count right
    const [reply] = await this.prisma.$transaction([
      this.prisma.community_replies.create({
        data: { post_id: postId, author_id: userId, body: safe },
        include: { profiles: { select: AUTHOR_SELECT } },
      }),
      this.prisma.community_posts.update({ where: { id: postId }, data: { reply_count: { increment: 1 } } }),
    ]);

    if (post.author_id !== userId) {
      const blockedMe = await this.prisma.blocks.findUnique({
        where: { blocker_id_blocked_id: { blocker_id: post.author_id, blocked_id: userId } },
      });
      if (!blockedMe) {
        const name = reply.profiles?.full_name || 'Someone';
        await this.notifications
          .create(post.author_id, 'community_reply', `${name} replied to your post`, safe.slice(0, 120), {
            postId,
            replyId: reply.id,
          })
          .catch((e) => this.logger.warn(`reply notification failed: ${(e as Error).message}`));
      }
    }
    return reply;
  }

  async deleteReply(userId: string, replyId: string) {
    const reply = isUuid(replyId)
      ? await this.prisma.community_replies.findUnique({ where: { id: replyId }, select: { author_id: true, post_id: true } })
      : null;
    if (!reply) throw new NotFoundException('Reply not found.');
    if (reply.author_id !== userId) throw new ForbiddenException('Not your reply.');
    await this.prisma.$transaction([
      this.prisma.community_replies.delete({ where: { id: replyId } }),
      this.prisma.$executeRaw`update community_posts set reply_count = greatest(reply_count - 1, 0) where id = ${reply.post_id}::uuid`,
    ]);
    return { ok: true };
  }

  async amenReply(userId: string, replyId: string) {
    if (!isUuid(replyId)) throw new NotFoundException('Reply not found.');
    const removed = await this.prisma.community_reply_amens.deleteMany({ where: { reply_id: replyId, user_id: userId } });
    if (removed.count) {
      await this.prisma.$executeRaw`select adjust_reply_amen_count(${replyId}::uuid, -1)`;
    } else {
      let added = false;
      try {
        const ins = await this.prisma.community_reply_amens.createMany({
          data: { reply_id: replyId, user_id: userId },
          skipDuplicates: true,
        });
        added = ins.count > 0;
      } catch (e) {
        if (prismaCode(e) === 'P2003') throw new NotFoundException('Reply not found.');
        throw e;
      }
      if (added) await this.prisma.$executeRaw`select adjust_reply_amen_count(${replyId}::uuid, 1)`;
    }
    const reply = await this.prisma.community_replies.findUnique({ where: { id: replyId }, select: { amen_count: true } });
    const has = !removed.count;
    return { amen_count: reply?.amen_count ?? 0, has_amened: has, amened: has };
  }
}
