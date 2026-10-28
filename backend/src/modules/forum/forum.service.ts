import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { dbBadRequest, isUuid } from '../events/event-helpers';

const POST_SELECT = { id: true, content: true, image_url: true, message_type: true, created_at: true, user_id: true } as const;

@Injectable()
export class ForumService {
  private readonly log = new Logger('Forum');

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Oldest first, max 200, each with `profiles: { full_name, avatar_url, avatar_color }` like the Supabase embed. */
  async list(eventId: string) {
    if (!isUuid(eventId)) return { posts: [] };
    const rows = await this.prisma.event_forum_posts.findMany({
      where: { event_id: eventId },
      orderBy: { created_at: 'asc' },
      take: 200,
      select: POST_SELECT,
    });
    const ids = [...new Set(rows.map((p) => p.user_id))];
    const profiles = ids.length
      ? await this.prisma.profiles.findMany({
          where: { id: { in: ids } },
          select: { id: true, full_name: true, avatar_url: true, avatar_color: true },
        })
      : [];
    const byId = new Map(profiles.map(({ id, ...p }) => [id, p]));
    return { posts: rows.map((p) => ({ ...p, profiles: byId.get(p.user_id) ?? null })) };
  }

  async create(eventId: string, userId: string, body: Record<string, unknown>) {
    const { content, image_url, message_type = 'text' } = body;
    const text = typeof content === 'string' ? content.trim() : '';
    if (!text && !image_url) throw new BadRequestException('Message content or image required.');
    if ((image_url != null && typeof image_url !== 'string') || typeof message_type !== 'string') {
      throw new BadRequestException('Invalid message.');
    }
    const ev = isUuid(eventId)
      ? await this.prisma.events.findUnique({ where: { id: eventId }, select: { id: true, name: true, host_id: true, forum_enabled: true } })
      : null;
    if (!ev) throw new NotFoundException('Event not found.');
    if (ev.forum_enabled === false) throw new ForbiddenException('Forum disabled for this event.');
    const post = await dbBadRequest(
      this.prisma.event_forum_posts.create({
        // content is NOT NULL: an image-only message stores '' (server.js sent null, which the column rejects)
        data: { event_id: eventId, user_id: userId, image_url: (image_url as string) || null, message_type, content: text },
        select: POST_SELECT,
      }),
    );
    if (ev.host_id !== userId) void this.notifyHost(ev, userId, post.id, text);
    return post;
  }

  private async notifyHost(ev: { id: string; name: string; host_id: string }, userId: string, postId: string, text: string) {
    try {
      const author = await this.prisma.profiles.findUnique({ where: { id: userId }, select: { full_name: true } });
      await this.notifications.create(
        ev.host_id,
        'forum_reply',
        `${author?.full_name || 'Someone'} posted in ${ev.name}`,
        text ? text.slice(0, 140) : 'Sent a photo',
        { eventId: ev.id, event_id: ev.id, postId },
      );
    } catch (e) {
      this.log.error(`forum notification failed: ${(e as Error).message}`);
    }
  }

  /** Own messages only. */
  async remove(postId: string, userId: string) {
    const post = isUuid(postId)
      ? await this.prisma.event_forum_posts.findUnique({ where: { id: postId }, select: { user_id: true } })
      : null;
    if (!post) throw new NotFoundException('Post not found.');
    if (post.user_id !== userId) throw new ForbiddenException('Not your message.');
    await this.prisma.event_forum_posts.deleteMany({ where: { id: postId } });
    return { success: true };
  }
}
