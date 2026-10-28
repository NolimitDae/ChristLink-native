import { BadRequestException, Injectable, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { parseDataUrl, StorageService } from '../storage/storage.service';
import { AuthUser } from '../../common/auth.decorators';
import { AUTHOR_SELECT, isUuid, prismaCode, sanitizeText } from '../community/text';

/** server.js PATCH /api/profile whitelist (role, identity_verified, email stay server-only). */
const TEXT_FIELDS = [
  'full_name', 'bio', 'city', 'avatar_url', 'avatar_color', 'avatar_ring_color',
  'instagram_url', 'facebook_url', 'tiktok_url', 'banner_url', 'bible_verse', 'bible_verse_reference',
  'bible_version', 'hot_takes', 'hobbies', 'prayer_request', 'testimony',
] as const;

const PUBLIC_SELECT = {
  id: true, full_name: true, avatar_url: true, avatar_color: true, avatar_ring_color: true, banner_url: true,
  bio: true, city: true, role: true, created_at: true, instagram_url: true, facebook_url: true, tiktok_url: true,
  bible_verse: true, bible_verse_reference: true, bible_version: true, hot_takes: true, hobbies: true,
  connect_tags: true, prayer_request: true, testimony: true, prayer_supporters: true,
} as const;

const LIST_SELECT = { ...AUTHOR_SELECT, city: true, role: true } as const;
const ID_DOC_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'application/pdf': 'pdf' };

/** Picks the editable profile fields from a loose body. Exported for the unit test. */
export function pickProfileUpdates(body: Record<string, unknown>) {
  const updates: Record<string, unknown> = {};
  for (const k of TEXT_FIELDS) {
    const v = body?.[k];
    if (v === undefined) continue;
    if (v !== null && typeof v !== 'string') throw new BadRequestException(`${k} must be text.`);
    updates[k] = v;
  }
  if (body?.connect_tags !== undefined) {
    updates.connect_tags = Array.isArray(body.connect_tags) ? body.connect_tags.filter((t) => typeof t === 'string') : [];
  }
  return updates;
}

@Injectable()
export class ProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  private counts(userId: string) {
    return Promise.all([
      this.prisma.user_follows.count({ where: { following_id: userId } }),
      this.prisma.user_follows.count({ where: { follower_id: userId } }),
    ]);
  }

  async me(user: AuthUser) {
    const [profile, stripe, [followers, following]] = await Promise.all([
      this.prisma.profiles.findUnique({ where: { id: user.id } }),
      this.prisma.host_stripe_accounts.findMany({
        where: { user_id: user.id },
        select: { stripe_account_id: true, onboarding_complete: true, payouts_enabled: true, charges_enabled: true },
      }),
      this.counts(user.id),
    ]);
    if (!profile) {
      return {
        id: user.id,
        email: user.email,
        full_name: user.email?.split('@')[0] || '',
        role: 'attendee',
        created_at: new Date().toISOString(),
        host_stripe_accounts: [],
        followers_count: 0,
        following_count: 0,
      };
    }
    return { ...profile, host_stripe_accounts: stripe, followers_count: followers, following_count: following };
  }

  async update(user: AuthUser, body: Record<string, unknown>) {
    const updates = { ...pickProfileUpdates(body), updated_at: new Date() };
    // The row normally exists from sign-in; create it if missing (server.js did the same)
    return this.prisma.profiles.upsert({
      where: { id: user.id },
      update: updates,
      create: { id: user.id, email: user.email, ...updates },
    });
  }

  async togglePrayerSupport(userId: string, targetId: unknown) {
    if (!targetId) throw new BadRequestException('target_user_id required');
    if (targetId === userId) throw new BadRequestException('Cannot support your own prayer');
    if (!isUuid(targetId)) throw new NotFoundException('Profile not found.');
    return this.prisma.$transaction(async (tx) => {
      // Row lock: two people toggling at once must not overwrite each other's change
      const rows = await tx.$queryRaw<{ prayer_supporters: unknown }[]>`
        select prayer_supporters from profiles where id = ${targetId}::uuid for update`;
      if (!rows.length) throw new NotFoundException('Profile not found.');
      const supporters = Array.isArray(rows[0].prayer_supporters) ? (rows[0].prayer_supporters as string[]) : [];
      const already = supporters.includes(userId);
      const updated = already ? supporters.filter((id) => id !== userId) : [...supporters, userId];
      const row = await tx.profiles.update({
        where: { id: targetId },
        data: { prayer_supporters: updated },
        select: { prayer_supporters: true },
      });
      return { prayer_supporters: row.prayer_supporters, supporting: !already };
    });
  }

  async publicProfile(targetId: string, viewerId?: string) {
    const profile = isUuid(targetId)
      ? await this.prisma.profiles.findUnique({ where: { id: targetId }, select: PUBLIC_SELECT })
      : null;
    if (!profile) throw new NotFoundException('Profile not found.');
    const [followers_count, following_count] = await this.counts(targetId);
    if (!viewerId) {
      const { id, full_name, avatar_url, avatar_color, banner_url } = profile;
      return { id, full_name, avatar_url, avatar_color, banner_url, restricted: true, followers_count, following_count };
    }
    const is_following =
      viewerId !== targetId &&
      !!(await this.prisma.user_follows.findUnique({
        where: { follower_id_following_id: { follower_id: viewerId, following_id: targetId } },
        select: { id: true },
      }));
    return { ...profile, followers_count, following_count, is_following };
  }

  async profileCard(id: string) {
    const profile = isUuid(id)
      ? await this.prisma.profiles.findUnique({
          where: { id },
          select: {
            id: true, full_name: true, bio: true, city: true, avatar_url: true, avatar_color: true, role: true,
            created_at: true, instagram_url: true, facebook_url: true, tiktok_url: true,
          },
        })
      : null;
    if (!profile) throw new NotFoundException('Profile not found.');
    return profile;
  }

  async hostStats(hostId: string) {
    if (!isUuid(hostId)) return { eventsHosted: 0, totalAttendees: 0, isVerified: false };
    const [profile, eventsHosted, totalAttendees] = await Promise.all([
      this.prisma.profiles.findUnique({ where: { id: hostId }, select: { role: true } }),
      this.prisma.events.count({ where: { host_id: hostId, status: 'published' } }),
      this.prisma.tickets.count({ where: { status: 'confirmed', events: { host_id: hostId, status: 'published' } } }),
    ]);
    return { eventsHosted, totalAttendees, isVerified: profile?.role === 'verified' || profile?.role === 'admin' };
  }

  async follow(userId: string, targetId: string) {
    if (targetId === userId) throw new BadRequestException('Cannot follow yourself.');
    if (!isUuid(targetId)) throw new NotFoundException('User not found.');
    try {
      await this.prisma.user_follows.createMany({
        data: { follower_id: userId, following_id: targetId },
        skipDuplicates: true,
      });
    } catch (e) {
      if (prismaCode(e) === 'P2003') throw new NotFoundException('User not found.');
      throw e;
    }
    return { following: true };
  }

  async unfollow(userId: string, targetId: string) {
    if (isUuid(targetId)) await this.prisma.user_follows.deleteMany({ where: { follower_id: userId, following_id: targetId } });
    return { following: false };
  }

  async myFollowers(userId: string) {
    const rows = await this.prisma.user_follows.findMany({
      where: { following_id: userId },
      select: { profiles_user_follows_follower_idToprofiles: { select: AUTHOR_SELECT } },
    });
    return { followers: rows.map((r) => r.profiles_user_follows_follower_idToprofiles) };
  }

  async followersOf(userId: string) {
    if (!isUuid(userId)) return { users: [] };
    const rows = await this.prisma.user_follows.findMany({
      where: { following_id: userId },
      orderBy: { created_at: 'desc' },
      take: 200,
      select: { profiles_user_follows_follower_idToprofiles: { select: LIST_SELECT } },
    });
    return { users: rows.map((r) => r.profiles_user_follows_follower_idToprofiles) };
  }

  async followingOf(userId: string) {
    if (!isUuid(userId)) return { users: [] };
    const rows = await this.prisma.user_follows.findMany({
      where: { follower_id: userId },
      orderBy: { created_at: 'desc' },
      take: 200,
      select: { profiles_user_follows_following_idToprofiles: { select: LIST_SELECT } },
    });
    return { users: rows.map((r) => r.profiles_user_follows_following_idToprofiles) };
  }

  async upload(prefix: 'avatars' | 'banners', userId: string, dataUrl: unknown) {
    return { url: await this.storage.putDataUrl(prefix, userId, dataUrl) };
  }

  async submitIdentity(userId: string, legalName: unknown, doc: unknown) {
    if (typeof legalName !== 'string' || !legalName.trim()) throw new BadRequestException('Legal name is required.');
    if (!doc) throw new BadRequestException('ID document photo is required.');
    let parsed: { buffer: Buffer; type: string };
    try {
      parsed = parseDataUrl(doc, { maxBytes: 10 * 1024 * 1024, allowed: Object.keys(ID_DOC_TYPES) });
    } catch (e) {
      if (e instanceof PayloadTooLargeException) throw new PayloadTooLargeException('ID document must be under 10 MB.');
      throw e;
    }
    const cleanName = sanitizeText(legalName);
    if (!cleanName) throw new BadRequestException('Legal name is required.');
    const key = await this.storage.putPrivate(
      `private/id-docs/${userId}/${randomUUID()}.${ID_DOC_TYPES[parsed.type]}`,
      parsed.buffer,
      parsed.type,
    );
    const fields = {
      status: 'pending', legal_name: cleanName, id_doc_path: key, submitted_at: new Date(),
      verified_at: null, rejected_reason: null, reviewed_by: null,
    };
    await this.prisma.identity_verifications.upsert({
      where: { user_id: userId },
      update: fields,
      create: { user_id: userId, ...fields },
    });
    // Keep profile full_name in sync with the legal name
    const prof = await this.prisma.profiles.findUnique({ where: { id: userId }, select: { full_name: true } });
    if (prof && prof.full_name?.toLowerCase().trim() !== cleanName.toLowerCase()) {
      await this.prisma.profiles.update({ where: { id: userId }, data: { full_name: cleanName } });
    }
    return { success: true };
  }

  async identityStatus(userId: string) {
    const verification = await this.prisma.identity_verifications.findUnique({
      where: { user_id: userId },
      select: { status: true, legal_name: true, submitted_at: true, verified_at: true, rejected_reason: true },
    });
    return { verification };
  }

  async notifications(userId: string) {
    const notifications = await this.prisma.notifications.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: 30,
    });
    return { notifications };
  }

  async readAll(userId: string) {
    await this.prisma.notifications.updateMany({ where: { user_id: userId, read: false }, data: { read: true } });
    return { success: true };
  }
}
