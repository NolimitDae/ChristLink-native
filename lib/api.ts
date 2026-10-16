import { API_BASE, API_TIMEOUT_MS, API_MAX_RETRIES } from './constants';
import { logger } from './logger';
import type {
  AppNotification,
  CommunityPost,
  CommunityPostsResponse,
  CommunityReply,
  CouponResult,
  CreateEventPayload,
  Event,
  EventSales,
  EventsResponse,
  ForumMessage,
  HostStats,
  IdentityStatus,
  MyEventsResponse,
  MyRsvpsResponse,
  MyTicketsResponse,
  PaymentIntentResponse,
  PersonSummary,
  PostType,
  Profile,
  RefundRequest,
  RSVP,
  ServerPriceBreakdown,
  Ticket,
  TicketType,
  TicketVerifyResult,
} from './types';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryable: boolean,
    public readonly body?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function createCombinedSignal(a: AbortSignal, b: AbortSignal): AbortSignal {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (a.aborted || b.aborted) controller.abort();
  else {
    a.addEventListener('abort', abort, { once: true });
    b.addEventListener('abort', abort, { once: true });
  }
  return controller.signal;
}

interface FetchOptions extends RequestInit {
  /** Non-idempotent requests (payments, posts) must not be retried automatically. */
  retry?: boolean;
}

export async function apiFetch<T>(
  path: string,
  options: FetchOptions = {},
  accessToken?: string,
  signal?: AbortSignal,
): Promise<T> {
  const { retry, ...init } = options;
  const method = (init.method ?? 'GET').toUpperCase();
  const canRetry = retry ?? (method === 'GET' || method === 'HEAD');
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    ...(init.headers as Record<string, string>),
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let attempt = 0;
  for (;;) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
    const combined = signal ? createCombinedSignal(signal, controller.signal) : controller.signal;

    try {
      const response = await fetch(`${API_BASE}${path}`, { ...init, headers, signal: combined });
      clearTimeout(timeoutId);
      const text = await response.text();
      let data: unknown = null;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = { error: text.slice(0, 200) };
        }
      }

      if (!response.ok) {
        const body = (data ?? {}) as Record<string, unknown>;
        const message = typeof body.error === 'string' ? body.error : `Request failed (${response.status})`;
        const retryable = isRetryable(response.status);
        if (retryable && canRetry && attempt < API_MAX_RETRIES) {
          const backoff = Math.min(1000 * 2 ** attempt, 8000);
          logger.warn(`API ${response.status}, retrying in ${backoff}ms`, { path, attempt: attempt + 1 });
          attempt++;
          await sleep(backoff);
          continue;
        }
        throw new ApiError(message, response.status, retryable, body);
      }
      return (data ?? {}) as T;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof ApiError) throw err;
      if ((err as Error).name === 'AbortError') {
        if (signal?.aborted) throw new ApiError('Request cancelled', 0, false);
        if (!canRetry || attempt >= API_MAX_RETRIES) throw new ApiError('Request timed out', 0, true);
      } else if (!canRetry || attempt >= API_MAX_RETRIES) {
        logger.error('API request failed', { path, error: String(err) });
        throw new ApiError('Network error. Please check your connection.', 0, true);
      }
      const backoff = Math.min(1000 * 2 ** attempt, 8000);
      attempt++;
      await sleep(backoff);
    }
  }
}

function json(body: unknown, method = 'POST'): FetchOptions {
  return { method, body: JSON.stringify(body) };
}

// ── Normalizers: the API returns some web-specific field names ────────────
type RawEvent = Partial<Omit<Event, 'ticket_types'>> & {
  host_avatar?: string;
  confirmed_rsvps?: number;
  ticket_types?: (TicketType & { sold?: number })[] | null;
};

export function normalizeEvent(raw: RawEvent): Event {
  const ticketTypes = (raw.ticket_types ?? []).map(tt => ({
    ...tt,
    tickets_sold: tt.tickets_sold ?? tt.sold ?? 0,
  }));
  return {
    ...(raw as Event),
    host_avatar_url: raw.host_avatar_url ?? raw.host_avatar,
    going_count: raw.going_count ?? raw.confirmed_rsvps ?? raw.rsvp_count ?? 0,
    ticket_types: ticketTypes,
    format: raw.format ?? 'in_person',
  };
}

type RawPost = Partial<CommunityPost> & { author_id?: string; body?: string };

export function normalizePost(raw: RawPost): CommunityPost {
  return {
    ...(raw as CommunityPost),
    user_id: raw.user_id ?? raw.author_id ?? '',
    content: raw.content ?? raw.body ?? '',
    amen_count: raw.amen_count ?? 0,
    reply_count: raw.reply_count ?? 0,
  };
}

type RawReply = Partial<CommunityReply> & { author_id?: string; body?: string };

export function normalizeReply(raw: RawReply): CommunityReply {
  return {
    ...(raw as CommunityReply),
    user_id: raw.user_id ?? raw.author_id ?? '',
    content: raw.content ?? raw.body ?? '',
  };
}

// ── Events ───────────────────────────────────────────────────
export interface GetEventsParams {
  type?: string;
  city?: string;
  lat?: number;
  lng?: number;
  radius?: number;
  is_paid?: boolean;
  q?: string;
  format?: string;
  host_id?: string;
  include_past?: boolean;
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
}

export async function getEvents(params: GetEventsParams = {}): Promise<EventsResponse> {
  const { signal, ...rest } = params;
  const qs = new URLSearchParams();
  if (rest.type && rest.type !== 'All') qs.set('type', rest.type);
  if (rest.city) qs.set('city', rest.city);
  if (rest.lat !== undefined) qs.set('lat', String(rest.lat));
  if (rest.lng !== undefined) qs.set('lng', String(rest.lng));
  if (rest.radius !== undefined) qs.set('radius', String(rest.radius));
  if (rest.is_paid !== undefined) qs.set('is_paid', String(rest.is_paid));
  if (rest.q) qs.set('q', rest.q);
  if (rest.format) qs.set('format', rest.format);
  if (rest.host_id) qs.set('host_id', rest.host_id);
  if (rest.include_past) qs.set('include_past', 'true');
  if (rest.limit !== undefined) qs.set('limit', String(rest.limit));
  if (rest.offset !== undefined) qs.set('offset', String(rest.offset));
  const query = qs.toString() ? `?${qs.toString()}` : '';
  const res = await apiFetch<{ events?: RawEvent[] }>(`/api/events${query}`, {}, undefined, signal);
  return { events: (res.events ?? []).map(normalizeEvent) };
}

export async function getEvent(id: string, accessToken?: string, signal?: AbortSignal): Promise<Event> {
  return normalizeEvent(await apiFetch<RawEvent>(`/api/events/${encodeURIComponent(id)}`, {}, accessToken, signal));
}

export async function createEvent(payload: CreateEventPayload, accessToken: string): Promise<Event> {
  const res = await apiFetch<RawEvent & { event?: RawEvent }>('/api/events', json(payload), accessToken);
  return normalizeEvent(res.event ?? res);
}

export async function updateEvent(id: string, payload: Partial<CreateEventPayload>, accessToken: string): Promise<Event> {
  const res = await apiFetch<RawEvent & { event?: RawEvent }>(`/api/events/${id}`, json(payload, 'PATCH'), accessToken);
  return normalizeEvent(res.event ?? res);
}

export function publishEvent(id: string, accessToken: string): Promise<unknown> {
  return apiFetch(`/api/events/${id}/publish`, { method: 'PATCH' }, accessToken);
}

export function scheduleEvent(id: string, publishAt: string, accessToken: string): Promise<unknown> {
  return apiFetch(`/api/events/${id}/schedule`, json({ publish_at: publishAt }, 'PATCH'), accessToken);
}

export function duplicateEvent(id: string, accessToken: string): Promise<{ event?: Event; id?: string }> {
  return apiFetch(`/api/events/${id}/duplicate`, { method: 'POST' }, accessToken);
}

export function toggleEventVisibility(id: string, accessToken: string): Promise<unknown> {
  return apiFetch(`/api/events/${id}/toggle-visibility`, { method: 'PATCH' }, accessToken);
}

export async function getMyEvents(accessToken: string): Promise<MyEventsResponse> {
  const res = await apiFetch<{ events?: RawEvent[] }>('/api/my-events', {}, accessToken);
  return { events: (res.events ?? []).map(normalizeEvent) };
}

export async function getMyRsvps(accessToken: string): Promise<MyRsvpsResponse> {
  const res = await apiFetch<{ rsvps?: RSVP[] }>('/api/my-rsvps', {}, accessToken);
  return { rsvps: res.rsvps ?? [] };
}

export async function getMyTickets(accessToken: string): Promise<MyTicketsResponse> {
  const res = await apiFetch<{ tickets?: Ticket[] }>('/api/my-tickets', {}, accessToken);
  const tickets = (res.tickets ?? [])
    .filter(t => t.status !== 'pending' && t.status !== 'failed')
    .map(t => ({ ...t, ticket_type_name: t.ticket_type_name ?? t.ticket_types?.name ?? undefined }));
  return { tickets };
}

// ── RSVP ────────────────────────────────────────────────────
export function rsvpToEvent(eventId: string, accessToken: string): Promise<{ success?: boolean; rsvp?: RSVP }> {
  return apiFetch('/api/rsvp', json({ eventId }), accessToken);
}

export function cancelRsvp(eventId: string, accessToken: string): Promise<{ success?: boolean }> {
  return apiFetch(`/api/rsvp/${eventId}`, { method: 'DELETE' }, accessToken);
}

export function getRsvp(eventId: string, accessToken: string): Promise<{ rsvp: RSVP | null }> {
  return apiFetch(`/api/rsvp/${eventId}`, {}, accessToken);
}

export async function getEventAttendees(
  eventId: string,
  accessToken?: string,
  signal?: AbortSignal,
): Promise<{ attendees: PersonSummary[]; total: number }> {
  const res = await apiFetch<{ attendees?: PersonSummary[]; total?: number }>(
    `/api/events/${eventId}/attendees`,
    {},
    accessToken,
    signal,
  );
  const attendees = res.attendees ?? [];
  return { attendees, total: res.total ?? attendees.length };
}

export function inviteFollowers(eventId: string, followerIds: string[], accessToken: string): Promise<{ sent: number }> {
  return apiFetch(`/api/events/${eventId}/invite`, json({ followerIds }), accessToken);
}

// ── Payments (Stripe test mode until launch; see docs/PAYMENTS.md) ─────────
export function getPriceBreakdown(priceCents: number, qty: number, absorb: boolean): Promise<ServerPriceBreakdown> {
  return apiFetch(`/api/price-breakdown?price=${priceCents}&qty=${qty}&absorb=${absorb}`);
}

export async function getTaxEstimate(amountCents: number, accessToken: string): Promise<number> {
  const res = await apiFetch<{ taxAmountCents?: number }>('/api/tax-estimate', json({ amountCents }), accessToken);
  return res.taxAmountCents ?? 0;
}

export function validateCoupon(eventId: string, code: string, ticketPriceCents: number, qty: number): Promise<CouponResult> {
  return apiFetch(`/api/events/${eventId}/validate-coupon`, json({ code, ticketPriceCents, qty }));
}

export function createPaymentIntent(
  payload: { eventId: string; ticketTypeId?: string; qty: number; buyerEmail?: string; couponCode?: string | null },
  accessToken: string,
): Promise<PaymentIntentResponse> {
  return apiFetch('/api/create-payment-intent', json(payload), accessToken);
}

/** Confirm-by-intent fallback: confirms the ticket immediately instead of waiting for the webhook. */
export function confirmTicketByIntent(paymentIntentId: string, accessToken: string): Promise<unknown> {
  return apiFetch('/api/tickets/confirm-by-intent', json({ paymentIntentId }), accessToken);
}

export function requestRefund(ticketId: string, reason: string, accessToken: string): Promise<unknown> {
  return apiFetch(`/api/tickets/${ticketId}/request-refund`, json({ reason }), accessToken);
}

export function hostRefundTicket(ticketId: string, accessToken: string): Promise<unknown> {
  return apiFetch(`/api/tickets/${ticketId}/refund`, { method: 'POST' }, accessToken);
}

export function walletPassUrl(ticketId: string): string {
  return `${API_BASE}/api/tickets/${ticketId}/wallet`;
}

export function validateListingPromo(
  code: string,
  accessToken: string,
): Promise<{ promo_id: string; discount_cents: number; final_cents: number; discount_type: string; discount_value: number }> {
  return apiFetch('/api/validate-listing-promo', json({ code }), accessToken);
}

export function chargeListingFee(
  payload: { paymentMethodId?: string; eventId: string; hostEmail?: string; promoCode?: string },
  accessToken: string,
): Promise<{ success: boolean; error?: string; resetCard?: boolean }> {
  return apiFetch('/api/charge-listing-fee', json(payload), accessToken);
}

// ── Host: sales, refunds, payouts, check-in ─────────────────
export async function getEventSales(eventId: string, accessToken: string): Promise<EventSales> {
  const res = await apiFetch<EventSales & { event: RawEvent }>(`/api/events/${eventId}/sales`, {}, accessToken);
  return { ...res, event: normalizeEvent(res.event), tickets: res.tickets ?? [], rsvps: res.rsvps ?? [] };
}

export async function getRefundRequests(eventId: string, accessToken: string): Promise<RefundRequest[]> {
  const res = await apiFetch<{ requests?: RefundRequest[] }>(`/api/refund-requests?eventId=${eventId}`, {}, accessToken);
  return res.requests ?? [];
}

export function decideRefundRequest(requestId: string, action: 'approve' | 'deny', accessToken: string): Promise<unknown> {
  return apiFetch(`/api/refund-requests/${requestId}/${action}`, { method: 'POST' }, accessToken);
}

export function verifyTicket(
  payload: { ticketId?: string; code?: string; eventId: string },
  accessToken: string,
): Promise<TicketVerifyResult> {
  return apiFetch('/api/tickets/verify', json(payload), accessToken);
}

export function getAttendance(eventId: string, accessToken: string): Promise<{ checked_in: number; total: number }> {
  return apiFetch(`/api/events/${eventId}/attendance`, {}, accessToken);
}

export function startConnectOnboarding(accessToken: string): Promise<{ url?: string; error?: string; platformSetup?: boolean }> {
  return apiFetch('/api/connect-onboard', { method: 'POST' }, accessToken);
}

export function syncConnectStatus(accessToken: string): Promise<unknown> {
  return apiFetch('/api/connect-sync', { method: 'POST' }, accessToken);
}

export function getHostStats(userId: string): Promise<HostStats> {
  return apiFetch(`/api/profiles/${userId}/stats`);
}

export function submitIdentity(legalName: string, idDocBase64: string, accessToken: string): Promise<unknown> {
  return apiFetch('/api/identity/submit', json({ legal_name: legalName, id_doc_base64: idDocBase64 }), accessToken);
}

export function getIdentityStatus(accessToken: string): Promise<IdentityStatus> {
  return apiFetch('/api/identity/status', {}, accessToken);
}

// ── Community ────────────────────────────────────────────────
export async function getCommunityPosts(accessToken?: string, signal?: AbortSignal): Promise<CommunityPostsResponse> {
  const res = await apiFetch<{ posts?: RawPost[] }>('/api/community-posts', {}, accessToken, signal);
  return { posts: (res.posts ?? []).map(normalizePost) };
}

export async function createCommunityPost(content: string, accessToken: string): Promise<CommunityPost> {
  const res = await apiFetch<RawPost & { post?: RawPost }>('/api/community-posts', json({ content, body: content }), accessToken);
  return normalizePost(res.post ?? res);
}

export function deleteCommunityPost(postId: string, accessToken: string): Promise<unknown> {
  return apiFetch(`/api/community-posts/${postId}`, { method: 'DELETE' }, accessToken);
}

export function amenPost(postId: string, accessToken: string): Promise<{ amened: boolean; amen_count: number }> {
  return apiFetch(`/api/community-posts/${postId}/amen`, { method: 'POST' }, accessToken);
}

export async function getCommunityReplies(postId: string, accessToken?: string, signal?: AbortSignal): Promise<{ replies: CommunityReply[] }> {
  const res = await apiFetch<{ replies?: RawReply[] }>(`/api/community-posts/${postId}/replies`, {}, accessToken, signal);
  return { replies: (res.replies ?? []).map(normalizeReply) };
}

export async function createCommunityReply(postId: string, content: string, accessToken: string): Promise<CommunityReply> {
  const res = await apiFetch<RawReply & { reply?: RawReply }>(
    `/api/community-posts/${postId}/replies`,
    json({ content, body: content }),
    accessToken,
  );
  return normalizeReply(res.reply ?? res);
}

export function amenReply(replyId: string, accessToken: string): Promise<{ amened: boolean; amen_count: number }> {
  return apiFetch(`/api/community-replies/${replyId}/amen`, { method: 'POST' }, accessToken);
}

export type { PostType };

// ── Event forum ──────────────────────────────────────────────
export async function getForum(eventId: string, accessToken?: string): Promise<ForumMessage[]> {
  const res = await apiFetch<{ posts?: ForumMessage[] } | ForumMessage[]>(`/api/events/${eventId}/forum`, {}, accessToken);
  return Array.isArray(res) ? res : res.posts ?? [];
}

export function postForum(eventId: string, content: string, accessToken: string): Promise<ForumMessage> {
  return apiFetch(`/api/events/${eventId}/forum`, json({ content }), accessToken);
}

// ── Profile & social ─────────────────────────────────────────
export function getProfile(accessToken: string, signal?: AbortSignal): Promise<Profile> {
  return apiFetch('/api/profile', {}, accessToken, signal);
}

export function updateProfile(updates: Partial<Profile>, accessToken: string): Promise<Profile> {
  return apiFetch('/api/profile', json(updates, 'PATCH'), accessToken);
}

export function getPublicProfile(userId: string, accessToken?: string): Promise<Profile> {
  return apiFetch(`/api/profile/public/${userId}`, {}, accessToken);
}

export function supportPrayerRequest(userId: string, accessToken: string): Promise<unknown> {
  return apiFetch('/api/profile/prayer-support', json({ userId }), accessToken);
}

export async function getFollowers(accessToken: string): Promise<PersonSummary[]> {
  const res = await apiFetch<{ followers?: PersonSummary[] }>('/api/followers', {}, accessToken);
  return res.followers ?? [];
}

export function followUser(userId: string, accessToken: string): Promise<{ following: boolean }> {
  return apiFetch(`/api/follow/${userId}`, { method: 'POST' }, accessToken);
}

export function unfollowUser(userId: string, accessToken: string): Promise<{ following: boolean }> {
  return apiFetch(`/api/follow/${userId}`, { method: 'DELETE' }, accessToken);
}

// ── Notifications inbox ──────────────────────────────────────
export async function getNotifications(accessToken: string): Promise<AppNotification[]> {
  const res = await apiFetch<{ notifications?: AppNotification[] }>('/api/notifications', {}, accessToken);
  return res.notifications ?? [];
}

export function markAllNotificationsRead(accessToken: string): Promise<unknown> {
  return apiFetch('/api/notifications/read-all', { method: 'POST' }, accessToken);
}

// ── Uploads ──────────────────────────────────────────────────
export function uploadAvatar(dataUrl: string, accessToken: string): Promise<{ url: string }> {
  return apiFetch('/api/upload-avatar', json({ dataUrl }), accessToken);
}

export function uploadBanner(dataUrl: string, accessToken: string): Promise<{ url: string }> {
  return apiFetch('/api/upload-banner', json({ dataUrl }), accessToken);
}

export function uploadEventImage(dataUrl: string, type: 'cover' | 'gallery', accessToken: string): Promise<{ url: string }> {
  return apiFetch('/api/upload-event-image', json({ dataUrl, type }), accessToken);
}

export function createTicketType(
  payload: { event_id: string; name: string; price_cents: number; quantity?: number },
  accessToken: string,
): Promise<TicketType> {
  return apiFetch('/api/ticket-types', json(payload), accessToken);
}

// ── Admin (role checked on the server) ───────────────────────
export function adminListVerifications(accessToken: string, status = 'pending'): Promise<{ verifications?: unknown[] }> {
  return apiFetch(`/api/admin/verifications?status=${status}`, {}, accessToken);
}

export function adminDecideVerification(id: string, approve: boolean, accessToken: string, reason?: string): Promise<unknown> {
  return apiFetch(
    `/api/admin/verifications/${id}/${approve ? 'approve' : 'reject'}`,
    json(approve ? {} : { reason }),
    accessToken,
  );
}

export function adminVerificationDocUrl(id: string, accessToken: string): Promise<{ url?: string }> {
  return apiFetch(`/api/admin/verifications/${id}/id-doc`, {}, accessToken);
}

export function adminDeletePost(postId: string, accessToken: string): Promise<unknown> {
  return apiFetch(`/api/admin/posts/${postId}`, { method: 'DELETE' }, accessToken);
}
