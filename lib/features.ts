/**
 * Features backed directly by Supabase tables and RPCs from supabase/migrations.
 * Every call goes through the signed-in user's JWT, so row-level security applies.
 * Until the migration is applied, calls fail with a "not set up" FeatureError and
 * screens show a friendly empty state instead of crashing.
 */
import { supabase } from './supabase';
import { logger } from './logger';
import { bundledVerseOfTheDay, type Verse } from './verses';
import type {
  Church,
  ChurchRecurringEvent,
  FriendActivity,
  FriendsGoing,
  PersonSummary,
  PostType,
  Prayer,
  PrayerFilter,
  ReportQueueItem,
  ReportReason,
  ReportTarget,
  ServeRosterEntry,
  ServeShift,
  UserSettings,
} from './types';

export const TERMS_VERSION = '2026-10-15';

export class FeatureError extends Error {
  constructor(message: string, public readonly notSetUp = false) {
    super(message);
    this.name = 'FeatureError';
  }
}

interface PgError {
  code?: string;
  message: string;
  details?: string | null;
  hint?: string | null;
}

function isMissing(err: PgError): boolean {
  return (
    err.code === '42P01' ||
    err.code === '42883' ||
    err.code === 'PGRST202' ||
    err.code === 'PGRST205' ||
    /does not exist|Could not find the (function|table)/i.test(err.message)
  );
}

function fail(scope: string, err: PgError): never {
  if (isMissing(err)) {
    logger.warn(`${scope}: feature tables not deployed yet`, { code: err.code });
    throw new FeatureError('This feature is being set up. Please check back soon.', true);
  }
  logger.error(`${scope} failed`, { code: err.code, message: err.message });
  throw new FeatureError(err.message.replace(/^.*?ERROR:\s*/, ''));
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) fail(fn, error);
  return data as T;
}

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new FeatureError('Please sign in first.');
  return id;
}

// ── Verse of the day ─────────────────────────────────────────
export async function getVerseOfTheDay(theme?: string | null): Promise<Verse> {
  try {
    const rows = await rpc<{ reference: string; text: string; translation: string }[]>('verse_of_the_day', {
      p_theme: theme ? theme.toLowerCase() : null,
    });
    const row = rows?.[0];
    if (row) return { ...row, themes: theme ? [theme] : [] };
  } catch {
    // fall through to bundled verse
  }
  return bundledVerseOfTheDay(theme);
}

export interface AdminVerse {
  id: number;
  reference: string;
  text: string;
  translation: string;
  themes: string[];
  active: boolean;
}

export async function listVerses(): Promise<AdminVerse[]> {
  const { data, error } = await supabase.from('verses').select('*').order('id');
  if (error) fail('listVerses', error);
  return (data ?? []) as AdminVerse[];
}

export async function saveVerse(v: Partial<AdminVerse> & { reference: string; text: string }): Promise<void> {
  const row = { reference: v.reference, text: v.text, translation: v.translation ?? 'WEB', themes: v.themes ?? [], active: v.active ?? true };
  const { error } = v.id
    ? await supabase.from('verses').update(row).eq('id', v.id)
    : await supabase.from('verses').insert(row);
  if (error) fail('saveVerse', error);
}

// ── Settings, consent, privacy ───────────────────────────────
export async function getSettings(): Promise<UserSettings | null> {
  const id = await uid();
  const { data, error } = await supabase.from('user_settings').select('*').eq('user_id', id).maybeSingle();
  if (error) fail('getSettings', error);
  return (data as UserSettings | null) ?? null;
}

export async function updateSettings(patch: Partial<Omit<UserSettings, 'user_id'>>): Promise<UserSettings> {
  const id = await uid();
  const { data, error } = await supabase
    .from('user_settings')
    .upsert({ user_id: id, ...patch }, { onConflict: 'user_id' })
    .select('*')
    .single();
  if (error) fail('updateSettings', error);
  return data as UserSettings;
}

export function acceptTerms(): Promise<UserSettings> {
  return updateSettings({ terms_version: TERMS_VERSION, terms_accepted_at: new Date().toISOString() });
}

export function confirmHostAdult(): Promise<UserSettings> {
  return updateSettings({ host_adult_confirmed_at: new Date().toISOString() });
}

export async function savePushToken(token: string, platform: 'ios' | 'android'): Promise<void> {
  const id = await uid();
  const { error } = await supabase
    .from('push_tokens')
    .upsert({ token, user_id: id, platform, updated_at: new Date().toISOString() }, { onConflict: 'token' });
  if (error) fail('savePushToken', error);
}

export async function deleteMyAccount(): Promise<void> {
  await rpc<void>('delete_my_account');
}

// ── Friends ──────────────────────────────────────────────────
export async function getFriendsGoing(eventIds: string[]): Promise<Record<string, FriendsGoing>> {
  if (eventIds.length === 0) return {};
  const { data: s } = await supabase.auth.getSession();
  if (!s.session) return {};
  try {
    const rows = await rpc<FriendsGoing[]>('friends_going', { p_event_ids: eventIds });
    return Object.fromEntries((rows ?? []).map(r => [r.event_id, r]));
  } catch {
    return {};
  }
}

export async function getFriendsThisWeek(): Promise<FriendActivity[]> {
  return (await rpc<FriendActivity[]>('friends_this_week')) ?? [];
}

export async function getMyFriends(): Promise<PersonSummary[]> {
  return (await rpc<PersonSummary[]>('my_friends')) ?? [];
}

// ── Prayer Wall ──────────────────────────────────────────────
export async function getPrayerWall(filter: PrayerFilter = 'all', before?: string): Promise<Prayer[]> {
  return (await rpc<Prayer[]>('get_prayer_wall', { p_filter: filter, p_limit: 30, p_before: before ?? null })) ?? [];
}

export async function createPrayer(body: string, isAnonymous: boolean, churchId?: string | null): Promise<void> {
  const id = await uid();
  const { error } = await supabase
    .from('prayers')
    .insert({ author_id: id, body: body.trim(), is_anonymous: isAnonymous, church_id: churchId ?? null });
  if (error) fail('createPrayer', error);
}

export function prayFor(prayerId: string): Promise<number> {
  return rpc<number>('pray_for', { p_prayer_id: prayerId });
}

export function markPrayerAnswered(prayerId: string, testimony: string): Promise<string> {
  return rpc<string>('mark_prayer_answered', { p_prayer_id: prayerId, p_testimony: testimony });
}

export async function deletePrayer(prayerId: string): Promise<void> {
  const { error } = await supabase.from('prayers').delete().eq('id', prayerId);
  if (error) fail('deletePrayer', error);
}

export async function setPostType(postId: string, type: Exclude<PostType, 'answered'>): Promise<void> {
  try {
    await rpc<void>('set_post_type', { p_post_id: postId, p_type: type });
  } catch (err) {
    logger.warn('setPostType skipped', { error: String(err) });
  }
}

// ── Reports and blocks ───────────────────────────────────────
export async function reportContent(targetType: ReportTarget, targetId: string, reason: ReportReason, details?: string): Promise<void> {
  const id = await uid();
  const { error } = await supabase
    .from('reports')
    .insert({ reporter_id: id, target_type: targetType, target_id: targetId, reason, details: details?.trim() || null });
  if (error && error.code !== '23505') fail('reportContent', error);
}

export async function blockUser(userId: string): Promise<void> {
  const id = await uid();
  const { error } = await supabase.from('blocks').insert({ blocker_id: id, blocked_id: userId });
  if (error && error.code !== '23505') fail('blockUser', error);
}

export async function unblockUser(userId: string): Promise<void> {
  const id = await uid();
  const { error } = await supabase.from('blocks').delete().eq('blocker_id', id).eq('blocked_id', userId);
  if (error) fail('unblockUser', error);
}

export async function getBlockedIds(): Promise<string[]> {
  const { data: s } = await supabase.auth.getSession();
  if (!s.session) return [];
  const { data, error } = await supabase.from('blocks').select('blocked_id');
  if (error) return [];
  return (data ?? []).map((r: { blocked_id: string }) => r.blocked_id);
}

export async function getReportQueue(): Promise<ReportQueueItem[]> {
  return (await rpc<ReportQueueItem[]>('admin_report_queue')) ?? [];
}

export function resolveReport(reportId: string, action: 'dismiss' | 'remove'): Promise<void> {
  return rpc<void>('resolve_report', { p_report_id: reportId, p_action: action });
}

// ── Churches ─────────────────────────────────────────────────
export async function searchChurches(query: string, limit = 20): Promise<Church[]> {
  let q = supabase.from('churches').select('*').order('verified', { ascending: false }).order('name').limit(limit);
  const term = query.trim();
  if (term) q = q.or(`name.ilike.%${term.replace(/[%,()]/g, '')}%,city.ilike.%${term.replace(/[%,()]/g, '')}%`);
  const { data, error } = await q;
  if (error) fail('searchChurches', error);
  return (data ?? []) as Church[];
}

export async function getChurch(id: string): Promise<Church | null> {
  const { data, error } = await supabase.from('churches').select('*').eq('id', id).maybeSingle();
  if (error) fail('getChurch', error);
  return data as Church | null;
}

export async function createChurch(input: Partial<Church> & { name: string }): Promise<Church> {
  const { data, error } = await supabase.from('churches').insert(input).select('*').single();
  if (error) fail('createChurch', error);
  return data as Church;
}

export async function updateChurch(id: string, patch: Partial<Church>): Promise<void> {
  const { error } = await supabase.from('churches').update(patch).eq('id', id);
  if (error) fail('updateChurch', error);
}

export async function claimChurch(churchId: string, roleAtChurch: string, note: string): Promise<void> {
  const id = await uid();
  const { error } = await supabase
    .from('church_claims')
    .insert({ church_id: churchId, user_id: id, role_at_church: roleAtChurch, note });
  if (error && error.code !== '23505') fail('claimChurch', error);
}

export interface ChurchClaim {
  id: string;
  church_id: string;
  user_id: string;
  role_at_church: string | null;
  note: string | null;
  status: string;
  created_at: string;
  churches?: { name: string } | null;
}

export async function listPendingClaims(): Promise<ChurchClaim[]> {
  const { data, error } = await supabase
    .from('church_claims')
    .select('*, churches(name)')
    .eq('status', 'pending')
    .order('created_at');
  if (error) fail('listPendingClaims', error);
  return (data ?? []) as ChurchClaim[];
}

export function decideChurchClaim(claimId: string, approve: boolean): Promise<void> {
  return rpc<void>('decide_church_claim', { p_claim_id: claimId, p_approve: approve });
}

export async function getChurchRecurring(churchId: string): Promise<ChurchRecurringEvent[]> {
  const { data, error } = await supabase
    .from('church_recurring_events')
    .select('*')
    .eq('church_id', churchId)
    .order('is_service', { ascending: false })
    .order('weekday');
  if (error) fail('getChurchRecurring', error);
  return (data ?? []) as ChurchRecurringEvent[];
}

export async function saveRecurring(input: Partial<ChurchRecurringEvent> & { church_id: string; name: string }): Promise<void> {
  const { id, ...row } = input;
  const { error } = id
    ? await supabase.from('church_recurring_events').update(row).eq('id', id)
    : await supabase.from('church_recurring_events').insert(row);
  if (error) fail('saveRecurring', error);
}

export async function deleteRecurring(id: string): Promise<void> {
  const { error } = await supabase.from('church_recurring_events').delete().eq('id', id);
  if (error) fail('deleteRecurring', error);
}

export async function getChurchEventIds(churchId: string): Promise<string[]> {
  const { data, error } = await supabase.from('church_events').select('event_id').eq('church_id', churchId);
  if (error) fail('getChurchEventIds', error);
  return (data ?? []).map((r: { event_id: string }) => r.event_id);
}

export async function linkEventToChurch(churchId: string, eventId: string): Promise<void> {
  const { error } = await supabase.from('church_events').insert({ church_id: churchId, event_id: eventId });
  if (error && error.code !== '23505') fail('linkEventToChurch', error);
}

export async function isFollowingChurch(churchId: string): Promise<boolean> {
  const id = await uid();
  const { data } = await supabase.from('church_follows').select('church_id').eq('church_id', churchId).eq('user_id', id).maybeSingle();
  return !!data;
}

export async function setFollowChurch(churchId: string, follow: boolean): Promise<void> {
  const id = await uid();
  const { error } = follow
    ? await supabase.from('church_follows').insert({ church_id: churchId, user_id: id })
    : await supabase.from('church_follows').delete().eq('church_id', churchId).eq('user_id', id);
  if (error && error.code !== '23505') fail('setFollowChurch', error);
}

export async function getMyManagedChurches(): Promise<Church[]> {
  const id = await uid();
  const { data, error } = await supabase.from('churches').select('*').eq('claimed_by', id).order('name');
  if (error) fail('getMyManagedChurches', error);
  return (data ?? []) as Church[];
}

// ── Serve ────────────────────────────────────────────────────
export async function getOpenShifts(opts: { churchId?: string | null; eventId?: string | null } = {}): Promise<ServeShift[]> {
  return (await rpc<ServeShift[]>('open_serve_shifts', {
    p_church_id: opts.churchId ?? null,
    p_event_id: opts.eventId ?? null,
  })) ?? [];
}

export async function signUpForShift(shiftId: string): Promise<{ id: string; code: string }> {
  const id = await uid();
  const { data, error } = await supabase
    .from('serve_signups')
    .upsert({ shift_id: shiftId, user_id: id, status: 'signed_up' }, { onConflict: 'shift_id,user_id' })
    .select('id, code')
    .single();
  if (error) fail('signUpForShift', error);
  return data as { id: string; code: string };
}

export async function cancelSignup(signupId: string): Promise<void> {
  const { error } = await supabase.from('serve_signups').update({ status: 'cancelled' }).eq('id', signupId);
  if (error) fail('cancelSignup', error);
}

export interface ServeRoleInput {
  event_id?: string | null;
  church_id?: string | null;
  name: string;
  description?: string;
  requirements?: string;
  shifts: { starts_at: string; ends_at: string; spots: number }[];
}

export async function createServeRole(input: ServeRoleInput): Promise<string> {
  const id = await uid();
  const { shifts, ...role } = input;
  const { data, error } = await supabase
    .from('serve_roles')
    .insert({ ...role, created_by: id })
    .select('id')
    .single();
  if (error) fail('createServeRole', error);
  const roleId = (data as { id: string }).id;
  if (shifts.length > 0) {
    const { error: shiftErr } = await supabase.from('serve_shifts').insert(shifts.map(s => ({ ...s, role_id: roleId })));
    if (shiftErr) fail('createServeShifts', shiftErr);
  }
  return roleId;
}

export interface ManagedShift {
  id: string;
  role_id: string;
  starts_at: string;
  ends_at: string;
  spots: number;
  completed_at: string | null;
  serve_roles: { name: string; event_id: string | null; church_id: string | null };
}

export async function getMyManagedShifts(): Promise<ManagedShift[]> {
  const id = await uid();
  const { data, error } = await supabase
    .from('serve_shifts')
    .select('*, serve_roles!inner(name, event_id, church_id, created_by)')
    .eq('serve_roles.created_by', id)
    .order('starts_at');
  if (error) fail('getMyManagedShifts', error);
  return (data ?? []) as ManagedShift[];
}

export async function getShiftRoster(shiftId: string): Promise<ServeRosterEntry[]> {
  const { data, error } = await supabase
    .from('serve_signups')
    .select('*')
    .eq('shift_id', shiftId)
    .neq('status', 'cancelled')
    .order('created_at');
  if (error) fail('getShiftRoster', error);
  return (data ?? []) as ServeRosterEntry[];
}

export function serveCheckIn(code: string): Promise<{ valid: boolean; message?: string; error?: string }> {
  return rpc('serve_check_in', { p_code: code });
}

export function completeShift(shiftId: string): Promise<number> {
  return rpc<number>('complete_serve_shift', { p_shift_id: shiftId });
}

export function messageVolunteers(shiftId: string, message: string): Promise<number> {
  return rpc<number>('message_volunteers', { p_shift_id: shiftId, p_message: message });
}

export async function getHoursServed(): Promise<number> {
  try {
    return Number(await rpc<number>('my_hours_served')) || 0;
  } catch {
    return 0;
  }
}
