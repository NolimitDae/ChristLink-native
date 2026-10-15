// Supabase Edge Function: sends an Expo push for every row inserted into public.notifications.
// Wire it up with a Database Webhook (Database → Webhooks): table public.notifications, event INSERT,
// type "Supabase Edge Function" → push-dispatch, HTTP header `x-webhook-secret: <PUSH_WEBHOOK_SECRET>`.
// Secrets: PUSH_WEBHOOK_SECRET, EXPO_ACCESS_TOKEN (optional, enables enhanced push security).
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by the platform.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
}

const CATEGORY: Record<string, string> = {
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
  refund_request: 'host',
  refund_approved: 'refunds',
  refund_denied: 'refunds',
  verification: 'host',
  church_claim: 'host',
};

function hourIn(timezone: string | null): number {
  try {
    return Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: timezone ?? 'UTC' }).format(new Date())) % 24;
  } catch {
    return new Date().getUTCHours();
  }
}

export function inQuietHours(start: number | null, end: number | null, hour: number): boolean {
  if (start === null || end === null || start === end) return false;
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

Deno.serve(async req => {
  const secret = Deno.env.get('PUSH_WEBHOOK_SECRET');
  if (!secret || req.headers.get('x-webhook-secret') !== secret) {
    return new Response('Unauthorized', { status: 401 });
  }

  const payload = (await req.json()) as { type: string; record?: NotificationRow };
  const n = payload.record;
  if (payload.type !== 'INSERT' || !n?.user_id) return new Response('ignored', { status: 200 });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  const [{ data: settings }, { data: tokens }] = await Promise.all([
    admin.from('user_settings').select('notification_prefs, quiet_hours_start, quiet_hours_end, timezone').eq('user_id', n.user_id).maybeSingle(),
    admin.from('push_tokens').select('token').eq('user_id', n.user_id),
  ]);
  if (!tokens?.length) return new Response('no tokens', { status: 200 });

  const category = CATEGORY[n.type] ?? 'tickets';
  const prefs = (settings?.notification_prefs ?? {}) as Record<string, boolean>;
  if (prefs[category] === false) return new Response('muted by preference', { status: 200 });
  if (inQuietHours(settings?.quiet_hours_start ?? null, settings?.quiet_hours_end ?? null, hourIn(settings?.timezone ?? null))) {
    return new Response('quiet hours', { status: 200 });
  }

  const messages = tokens.map(t => ({
    to: t.token,
    title: n.title,
    body: n.body ?? undefined,
    data: { ...(n.data ?? {}), notificationId: n.id, type: n.type },
    sound: 'default',
    channelId: 'default',
  }));

  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  const expoToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  if (expoToken) headers.Authorization = `Bearer ${expoToken}`;

  const res = await fetch('https://exp.host/--/api/v2/push/send', { method: 'POST', headers, body: JSON.stringify(messages) });
  const result = (await res.json()) as { data?: { status: string; details?: { error?: string } }[] };

  const dead = (result.data ?? [])
    .map((r, i) => (r.status === 'error' && r.details?.error === 'DeviceNotRegistered' ? tokens[i].token : null))
    .filter((t): t is string => !!t);
  if (dead.length) await admin.from('push_tokens').delete().in('token', dead);

  return new Response(JSON.stringify({ sent: messages.length, removed: dead.length }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
