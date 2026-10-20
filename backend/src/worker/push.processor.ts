import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import appConfig from '../config/app.config';
import { PrismaService } from '../prisma/prisma.service';
import { PushJob, QUEUE_PUSH } from '../queues/queues';

// notifications.type -> user_settings.notification_prefs key (same table as the old push-dispatch Edge Function)
export const CATEGORY: Record<string, string> = {
  ticket_sale: 'host',
  ticket_confirmed: 'tickets',
  rsvp_confirmed: 'tickets',
  event_reminder: 'reminders',
  event_invite: 'new_events',
  new_event: 'new_events',
  friend_rsvp: 'friend_rsvps',
  prayer_answered: 'prayer',
  prayer_summary: 'prayer',
  serve_message: 'serve',
  serve_reminder: 'serve',
  forum_reply: 'forum',
  community_reply: 'forum',
  refund_request: 'host',
  refund_approved: 'refunds',
  refund_denied: 'refunds',
  verification: 'host',
  church_claim: 'host',
};

const EXPO_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH = 100;

export function hourIn(timezone: string | null, now = new Date()): number {
  try {
    return (
      Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: timezone ?? 'UTC' }).format(now)) % 24
    );
  } catch {
    return now.getUTCHours();
  }
}

export function inQuietHours(start: number | null, end: number | null, hour: number): boolean {
  if (start === null || end === null || start === end) return false;
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

/** Sends one notification to every device of its user through the Expo push API. */
@Processor(QUEUE_PUSH)
export class PushProcessor extends WorkerHost {
  private readonly logger = new Logger('Push');

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<PushJob>) {
    const n = await this.prisma.notifications.findUnique({ where: { id: job.data.notificationId } });
    if (!n) return 'notification gone';

    const [settings, tokens] = await Promise.all([
      this.prisma.user_settings.findUnique({ where: { user_id: n.user_id } }),
      this.prisma.push_tokens.findMany({ where: { user_id: n.user_id }, select: { token: true } }),
    ]);
    if (!tokens.length) return 'no tokens';

    const prefs = (settings?.notification_prefs ?? {}) as Record<string, boolean>;
    if (prefs[CATEGORY[n.type] ?? 'tickets'] === false) return 'muted by preference';
    if (inQuietHours(settings?.quiet_hours_start ?? null, settings?.quiet_hours_end ?? null, hourIn(settings?.timezone ?? null))) {
      return 'quiet hours';
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
    const expoToken = appConfig().expo.access_token;
    if (expoToken) headers.Authorization = `Bearer ${expoToken}`;

    const dead: string[] = [];
    for (let i = 0; i < tokens.length; i += BATCH) {
      const batch = tokens.slice(i, i + BATCH);
      const messages = batch.map((t) => ({
        to: t.token,
        title: n.title,
        body: n.body ?? undefined,
        data: { ...((n.data as object) ?? {}), notificationId: n.id, type: n.type },
        sound: 'default',
        channelId: 'default',
      }));
      const res = await fetch(EXPO_URL, { method: 'POST', headers, body: JSON.stringify(messages) });
      if (!res.ok) throw new Error(`Expo push ${res.status}: ${await res.text()}`); // BullMQ retries
      const result = (await res.json()) as { data?: { status: string; details?: { error?: string } }[] };
      (result.data ?? []).forEach((r, idx) => {
        if (r.status === 'error' && r.details?.error === 'DeviceNotRegistered') dead.push(batch[idx].token);
      });
    }
    if (dead.length) await this.prisma.push_tokens.deleteMany({ where: { token: { in: dead } } });
    this.logger.log(`notification ${n.id}: sent ${tokens.length}, removed ${dead.length}`);
    return { sent: tokens.length, removed: dead.length };
  }
}
