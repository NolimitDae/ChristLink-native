import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Getting started: a new account's welcome tour and its setup checklist (Notifications screen). Each step is worked
 * out from what the person has actually done, so it is right on every device and can't be ticked by hand.
 */
export const SETUP_STEPS = ['photo', 'cover', 'bio', 'interests', 'church', 'post', 'event'] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];

/** The welcome tour is for accounts made in the last few days (not people who moved over from the old site). */
export const NEW_ACCOUNT_DAYS = 14;

export interface GettingStarted {
  steps: { id: SetupStep; done: boolean }[];
  done: number;
  total: number;
  /** Show the welcome tour: a new account that hasn't seen it. */
  welcome: boolean;
  /** Show the checklist: not finished and not hidden. */
  show: boolean;
  /** Everything is done and the thank-you hasn't been shown yet: the app calls POST /celebrate. */
  celebrate: boolean;
  completed_at: string | null;
}

const filled = (v: string | null | undefined) => !!v && v.trim().length > 0;

@Injectable()
export class GettingStartedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private async progress(uid: string) {
    const [profile, settings, post, prayer, rsvp, ticket] = await Promise.all([
      this.prisma.profiles.findUnique({
        where: { id: uid },
        select: { avatar_url: true, banner_url: true, bio: true, hobbies: true, connect_tags: true, created_at: true },
      }),
      this.prisma.user_settings.findUnique({ where: { user_id: uid } }),
      this.prisma.community_posts.findFirst({ where: { author_id: uid }, select: { id: true } }),
      this.prisma.prayers.findFirst({ where: { author_id: uid }, select: { id: true } }),
      this.prisma.rsvps.findFirst({ where: { user_id: uid, status: 'confirmed' }, select: { id: true } }),
      this.prisma.tickets.findFirst({ where: { user_id: uid, status: 'confirmed' }, select: { id: true } }),
    ]);
    const done: Record<SetupStep, boolean> = {
      photo: filled(profile?.avatar_url),
      cover: filled(profile?.banner_url),
      bio: filled(profile?.bio),
      interests: filled(profile?.hobbies) || (profile?.connect_tags?.length ?? 0) > 0,
      church: !!settings?.home_church_id,
      post: !!post || !!prayer,
      event: !!rsvp || !!ticket,
    };
    return { profile, settings, done };
  }

  async status(uid: string, now = new Date()): Promise<GettingStarted> {
    const { profile, settings, done } = await this.progress(uid);
    const steps = SETUP_STEPS.map((id) => ({ id, done: done[id] }));
    const count = steps.filter((s) => s.done).length;
    const all = count === steps.length;
    let started = settings?.setup_started_at ?? null;
    let completed = settings?.setup_completed_at ?? null;

    // Remember that this person saw the checklist unfinished; only then does finishing it earn a thank-you. Someone
    // whose profile was already complete the first time they look is marked done quietly.
    if (!completed && !started && !all) {
      started = now;
      await this.prisma.user_settings.upsert({ where: { user_id: uid }, create: { user_id: uid, setup_started_at: now }, update: { setup_started_at: now } });
    } else if (!completed && !started && all) {
      completed = now;
      await this.prisma.user_settings.upsert({ where: { user_id: uid }, create: { user_id: uid, setup_completed_at: now }, update: { setup_completed_at: now } });
    }

    const createdAt = profile?.created_at ? new Date(profile.created_at) : null;
    const isNew = !!createdAt && now.getTime() - createdAt.getTime() < NEW_ACCOUNT_DAYS * 86_400_000;
    return {
      steps,
      done: count,
      total: steps.length,
      welcome: isNew && !settings?.welcomed_at,
      show: !completed && !settings?.setup_hidden_at,
      celebrate: all && !completed && !!started,
      completed_at: completed ? new Date(completed).toISOString() : null,
    };
  }

  /**
   * Marks the checklist finished. Only the first call that finds every step done gets `celebrate: true` (and sends
   * the "you're all set" notification), so two devices can't both celebrate.
   */
  async celebrate(uid: string): Promise<{ celebrate: boolean }> {
    const { done } = await this.progress(uid);
    if (!SETUP_STEPS.every((s) => done[s])) return { celebrate: false };
    const claimed = await this.prisma.user_settings.updateMany({
      where: { user_id: uid, setup_completed_at: null, setup_started_at: { not: null } },
      data: { setup_completed_at: new Date() },
    });
    if (claimed.count !== 1) return { celebrate: false };
    await this.notifications.create(
      uid,
      'setup_complete',
      'You’re all set up',
      'Thank you for making Christ Link Social home. We’re glad you’re here.',
      { route: '/notifications' },
    );
    return { celebrate: true };
  }

  async welcomed(uid: string) {
    const now = new Date();
    await this.prisma.user_settings.upsert({ where: { user_id: uid }, create: { user_id: uid, welcomed_at: now }, update: { welcomed_at: now } });
    return this.status(uid, now);
  }

  async hide(uid: string) {
    const now = new Date();
    await this.prisma.user_settings.upsert({ where: { user_id: uid }, create: { user_id: uid, setup_hidden_at: now }, update: { setup_hidden_at: now } });
    return this.status(uid, now);
  }
}
