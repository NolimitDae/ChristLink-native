/**
 * Native features (churches, prayers, verses, serve, reports, blocks, settings, push tokens) on the Railway API.
 * Every call sends the signed-in user's token through apiFetch. Until a route is deployed, calls fail with a
 * "not set up" FeatureError and screens show a friendly empty state instead of crashing.
 */
import { ApiError, apiFetch, type FetchOptions } from './api';
import { logger } from './logger';
import { getSession } from './session';
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

/** Route not deployed: 501, or Express/Nest's "Cannot GET /api/..." 404 (a real "not found" 404 has its own message). */
function isMissing(err: ApiError): boolean {
  return err.status === 501 || (err.status === 404 && /Cannot (GET|POST|PATCH|PUT|DELETE) \//.test(err.message));
}

async function call<T>(scope: string, path: string, init: FetchOptions = {}): Promise<T> {
  try {
    return await apiFetch<T>(path, init);
  } catch (err) {
    if (!(err instanceof ApiError)) throw err;
    if (isMissing(err)) {
      logger.warn(`${scope}: route not deployed yet`, { status: err.status });
      throw new FeatureError('This feature is being set up. Please check back soon.', true);
    }
    if (err.status === 401) throw new FeatureError('Please sign in first.');
    logger.error(`${scope} failed`, { status: err.status, message: err.message });
    throw new FeatureError(err.message);
  }
}

const body = (b: unknown, method = 'POST'): FetchOptions => ({ method, body: JSON.stringify(b) });
const id = encodeURIComponent;

// ── Verse of the day ─────────────────────────────────────────
export async function getVerseOfTheDay(theme?: string | null): Promise<Verse> {
  try {
    const qs = theme ? `?theme=${id(theme.toLowerCase())}` : '';
    const row = await call<{ reference: string; text: string; translation: string } | null>('getVerseOfTheDay', `/api/verses/today${qs}`);
    if (row?.reference) return { ...row, themes: theme ? [theme] : [] };
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
  return (await call<AdminVerse[] | null>('listVerses', '/api/admin/verses')) ?? [];
}

export async function saveVerse(v: Partial<AdminVerse> & { reference: string; text: string }): Promise<void> {
  const row = { reference: v.reference, text: v.text, translation: v.translation ?? 'WEB', themes: v.themes ?? [], active: v.active ?? true };
  await (v.id
    ? call('saveVerse', `/api/admin/verses/${v.id}`, body(row, 'PATCH'))
    : call('saveVerse', '/api/admin/verses', body(row)));
}

// ── Settings, consent, privacy ───────────────────────────────
export async function getSettings(): Promise<UserSettings | null> {
  return (await call<UserSettings | null>('getSettings', '/api/settings')) ?? null;
}

export function updateSettings(patch: Partial<Omit<UserSettings, 'user_id'>>): Promise<UserSettings> {
  return call<UserSettings>('updateSettings', '/api/settings', body(patch, 'PATCH'));
}

export function acceptTerms(): Promise<UserSettings> {
  return updateSettings({ terms_version: TERMS_VERSION, terms_accepted_at: new Date().toISOString() });
}

export function confirmHostAdult(): Promise<UserSettings> {
  return updateSettings({ host_adult_confirmed_at: new Date().toISOString() });
}

export async function savePushToken(token: string, platform: 'ios' | 'android'): Promise<void> {
  await call('savePushToken', '/api/push-tokens', body({ token, platform }));
}

/** Detaches this device's push token from the account at sign-out, so the next user doesn't get these pushes. */
export async function deletePushToken(token: string): Promise<void> {
  await call('deletePushToken', `/api/push-tokens/${id(token)}`, { method: 'DELETE' });
}

export async function deleteMyAccount(): Promise<void> {
  await call('deleteMyAccount', '/api/account', { method: 'DELETE' });
}

// ── Friends ──────────────────────────────────────────────────
export async function getFriendsGoing(eventIds: string[]): Promise<Record<string, FriendsGoing>> {
  if (eventIds.length === 0 || !getSession()) return {};
  try {
    const rows = await call<FriendsGoing[] | null>('getFriendsGoing', '/api/friends/going', body({ event_ids: eventIds }));
    return Object.fromEntries((rows ?? []).map(r => [r.event_id, r]));
  } catch {
    return {};
  }
}

export async function getFriendsThisWeek(): Promise<FriendActivity[]> {
  return (await call<FriendActivity[] | null>('getFriendsThisWeek', '/api/friends/this-week')) ?? [];
}

export async function getMyFriends(): Promise<PersonSummary[]> {
  return (await call<PersonSummary[] | null>('getMyFriends', '/api/friends')) ?? [];
}

// ── Prayer Wall ──────────────────────────────────────────────
export async function getPrayerWall(filter: PrayerFilter = 'all', before?: string): Promise<Prayer[]> {
  const qs = new URLSearchParams({ filter, limit: '30' });
  if (before) qs.set('before', before);
  return (await call<Prayer[] | null>('getPrayerWall', `/api/prayers?${qs.toString()}`)) ?? [];
}

export async function createPrayer(text: string, isAnonymous: boolean, churchId?: string | null): Promise<void> {
  await call('createPrayer', '/api/prayers', body({ body: text.trim(), is_anonymous: isAnonymous, church_id: churchId ?? null }));
}

export async function prayFor(prayerId: string): Promise<number> {
  return (await call<{ count: number }>('prayFor', `/api/prayers/${id(prayerId)}/pray`, { method: 'POST' })).count;
}

export async function markPrayerAnswered(prayerId: string, testimony: string): Promise<string> {
  return (await call<{ post_id: string }>('markPrayerAnswered', `/api/prayers/${id(prayerId)}/answer`, body({ testimony }))).post_id;
}

export async function deletePrayer(prayerId: string): Promise<void> {
  await call('deletePrayer', `/api/prayers/${id(prayerId)}`, { method: 'DELETE' });
}

export async function setPostType(postId: string, type: Exclude<PostType, 'answered'>): Promise<void> {
  try {
    await call('setPostType', `/api/community-posts/${id(postId)}/type`, body({ type }, 'PATCH'));
  } catch (err) {
    logger.warn('setPostType skipped', { error: String(err) });
  }
}

// ── Reports and blocks ───────────────────────────────────────
export async function reportContent(targetType: ReportTarget, targetId: string, reason: ReportReason, details?: string): Promise<void> {
  await call('reportContent', '/api/reports', body({ target_type: targetType, target_id: targetId, reason, details: details?.trim() || null }));
}

export async function blockUser(userId: string): Promise<void> {
  await call('blockUser', '/api/blocks', body({ user_id: userId }));
}

export async function unblockUser(userId: string): Promise<void> {
  await call('unblockUser', `/api/blocks/${id(userId)}`, { method: 'DELETE' });
}

export async function getBlockedIds(): Promise<string[]> {
  if (!getSession()) return [];
  try {
    return (await call<string[] | null>('getBlockedIds', '/api/blocks')) ?? [];
  } catch {
    return [];
  }
}

export async function getReportQueue(): Promise<ReportQueueItem[]> {
  return (await call<ReportQueueItem[] | null>('getReportQueue', '/api/admin/reports')) ?? [];
}

export async function resolveReport(reportId: string, action: 'dismiss' | 'remove'): Promise<void> {
  await call('resolveReport', `/api/admin/reports/${id(reportId)}/resolve`, body({ action }));
}

// ── Churches ─────────────────────────────────────────────────
export async function searchChurches(query: string, limit = 20): Promise<Church[]> {
  const qs = new URLSearchParams({ q: query.trim(), limit: String(limit) });
  return (await call<Church[] | null>('searchChurches', `/api/churches?${qs.toString()}`)) ?? [];
}

export async function getChurch(churchId: string): Promise<Church | null> {
  return (await call<Church | null>('getChurch', `/api/churches/${id(churchId)}`)) ?? null;
}

export function createChurch(input: Partial<Church> & { name: string }): Promise<Church> {
  return call<Church>('createChurch', '/api/churches', body(input));
}

export async function updateChurch(churchId: string, patch: Partial<Church>): Promise<void> {
  await call('updateChurch', `/api/churches/${id(churchId)}`, body(patch, 'PATCH'));
}

export async function claimChurch(churchId: string, roleAtChurch: string, note: string): Promise<void> {
  await call('claimChurch', `/api/churches/${id(churchId)}/claim`, body({ role_at_church: roleAtChurch, note }));
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
  return (await call<ChurchClaim[] | null>('listPendingClaims', '/api/admin/church-claims')) ?? [];
}

export async function decideChurchClaim(claimId: string, approve: boolean): Promise<void> {
  await call('decideChurchClaim', `/api/admin/church-claims/${id(claimId)}/decide`, body({ approve }));
}

export async function getChurchRecurring(churchId: string): Promise<ChurchRecurringEvent[]> {
  return (await call<ChurchRecurringEvent[] | null>('getChurchRecurring', `/api/churches/${id(churchId)}/recurring`)) ?? [];
}

export async function saveRecurring(input: Partial<ChurchRecurringEvent> & { church_id: string; name: string }): Promise<void> {
  const { id: rowId, ...row } = input;
  await (rowId
    ? call('saveRecurring', `/api/church-recurring/${id(rowId)}`, body(row, 'PATCH'))
    : call('saveRecurring', `/api/churches/${id(input.church_id)}/recurring`, body(row)));
}

export async function deleteRecurring(rowId: string): Promise<void> {
  await call('deleteRecurring', `/api/church-recurring/${id(rowId)}`, { method: 'DELETE' });
}

export async function getChurchEventIds(churchId: string): Promise<string[]> {
  return (await call<string[] | null>('getChurchEventIds', `/api/churches/${id(churchId)}/events`)) ?? [];
}

export async function linkEventToChurch(churchId: string, eventId: string): Promise<void> {
  await call('linkEventToChurch', `/api/churches/${id(churchId)}/events`, body({ event_id: eventId }));
}

export async function isFollowingChurch(churchId: string): Promise<boolean> {
  return !!(await call<{ following?: boolean } | null>('isFollowingChurch', `/api/churches/${id(churchId)}/follow`))?.following;
}

export async function setFollowChurch(churchId: string, follow: boolean): Promise<void> {
  await call('setFollowChurch', `/api/churches/${id(churchId)}/follow`, { method: follow ? 'POST' : 'DELETE' });
}

export async function getMyManagedChurches(): Promise<Church[]> {
  return (await call<Church[] | null>('getMyManagedChurches', '/api/my-churches')) ?? [];
}

// ── Serve ────────────────────────────────────────────────────
export async function getOpenShifts(opts: { churchId?: string | null; eventId?: string | null } = {}): Promise<ServeShift[]> {
  const qs = new URLSearchParams();
  if (opts.churchId) qs.set('church_id', opts.churchId);
  if (opts.eventId) qs.set('event_id', opts.eventId);
  const q = qs.toString() ? `?${qs.toString()}` : '';
  return (await call<ServeShift[] | null>('getOpenShifts', `/api/serve/shifts${q}`)) ?? [];
}

export function signUpForShift(shiftId: string): Promise<{ id: string; code: string }> {
  return call('signUpForShift', `/api/serve/shifts/${id(shiftId)}/signup`, { method: 'POST' });
}

export async function cancelSignup(signupId: string): Promise<void> {
  await call('cancelSignup', `/api/serve/signups/${id(signupId)}/cancel`, { method: 'POST' });
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
  return (await call<{ id: string }>('createServeRole', '/api/serve/roles', body(input))).id;
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
  return (await call<ManagedShift[] | null>('getMyManagedShifts', '/api/serve/my-shifts')) ?? [];
}

export async function getShiftRoster(shiftId: string): Promise<ServeRosterEntry[]> {
  return (await call<ServeRosterEntry[] | null>('getShiftRoster', `/api/serve/shifts/${id(shiftId)}/roster`)) ?? [];
}

export function serveCheckIn(code: string): Promise<{ valid: boolean; message?: string; error?: string }> {
  return call('serveCheckIn', '/api/serve/check-in', body({ code }));
}

export async function completeShift(shiftId: string): Promise<number> {
  return (await call<{ count: number }>('completeShift', `/api/serve/shifts/${id(shiftId)}/complete`, { method: 'POST' })).count;
}

export async function messageVolunteers(shiftId: string, message: string): Promise<number> {
  return (await call<{ count: number }>('messageVolunteers', `/api/serve/shifts/${id(shiftId)}/message`, body({ message }))).count;
}

export async function getHoursServed(): Promise<number> {
  try {
    return Number((await call<{ hours: number }>('getHoursServed', '/api/serve/hours')).hours) || 0;
  } catch {
    return 0;
  }
}
