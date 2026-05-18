import { API_BASE, API_TIMEOUT_MS, API_MAX_RETRIES } from './constants';
import { logger } from './logger';
import type {
  Event,
  CommunityPost,
  Profile,
  RSVP,
  TicketType,
  CreateEventPayload,
  EventsResponse,
  CommunityPostsResponse,
  MyEventsResponse,
  MyRsvpsResponse,
  MyTicketsResponse,
} from './types';

class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  accessToken?: string,
  signal?: AbortSignal,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  let attempt = 0;

  while (attempt <= API_MAX_RETRIES) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    const combinedSignal = signal
      ? createCombinedSignal(signal, controller.signal)
      : controller.signal;

    try {
      const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
        signal: combinedSignal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        const message = (data as { error?: string }).error ?? `API error ${response.status}`;
        const retryable = isRetryable(response.status);

        if (retryable && attempt < API_MAX_RETRIES) {
          const backoff = Math.min(1000 * 2 ** attempt, 8000);
          logger.warn(`API request failed (attempt ${attempt + 1}), retrying in ${backoff}ms`, {
            path,
            status: response.status,
          });
          attempt++;
          await sleep(backoff);
          continue;
        }

        throw new ApiError(message, response.status, retryable);
      }

      return data as T;
    } catch (err) {
      clearTimeout(timeoutId);

      if (err instanceof ApiError) throw err;

      if ((err as Error).name === 'AbortError') {
        if (signal?.aborted) {
          throw new ApiError('Request cancelled', 0, false);
        }
        throw new ApiError('Request timed out', 0, true);
      }

      if (attempt < API_MAX_RETRIES) {
        const backoff = Math.min(1000 * 2 ** attempt, 8000);
        logger.warn(`Network error (attempt ${attempt + 1}), retrying in ${backoff}ms`, { path });
        attempt++;
        await sleep(backoff);
        continue;
      }

      logger.error('API request failed after max retries', { path, error: String(err) });
      throw new ApiError('Network error. Please check your connection.', 0, false);
    }
  }

  throw new ApiError('Max retries exceeded', 0, false);
}

function createCombinedSignal(a: AbortSignal, b: AbortSignal): AbortSignal {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (a.aborted || b.aborted) {
    controller.abort();
  } else {
    a.addEventListener('abort', abort, { once: true });
    b.addEventListener('abort', abort, { once: true });
  }
  return controller.signal;
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
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
}

export function getEvents(params: GetEventsParams = {}): Promise<EventsResponse> {
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
  if (rest.limit !== undefined) qs.set('limit', String(rest.limit));
  if (rest.offset !== undefined) qs.set('offset', String(rest.offset));
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch<EventsResponse>(`/api/events${query}`, {}, undefined, signal);
}

export function getEvent(id: string, signal?: AbortSignal): Promise<Event> {
  return apiFetch<Event>(`/api/events/${id}`, {}, undefined, signal);
}

export function createEvent(payload: CreateEventPayload, accessToken: string): Promise<Event> {
  return apiFetch<Event>('/api/events', { method: 'POST', body: JSON.stringify(payload) }, accessToken);
}

export function updateEvent(
  id: string,
  payload: Partial<CreateEventPayload>,
  accessToken: string,
): Promise<Event> {
  return apiFetch<Event>(
    `/api/events/${id}`,
    { method: 'PATCH', body: JSON.stringify(payload) },
    accessToken,
  );
}

export function publishEvent(id: string, accessToken: string): Promise<Event> {
  return apiFetch<Event>(`/api/events/${id}/publish`, { method: 'PATCH' }, accessToken);
}

export function getMyEvents(accessToken: string): Promise<MyEventsResponse> {
  return apiFetch<MyEventsResponse>('/api/my-events', {}, accessToken);
}

export function getMyRsvps(accessToken: string): Promise<MyRsvpsResponse> {
  return apiFetch<MyRsvpsResponse>('/api/my-rsvps', {}, accessToken);
}

export function getMyTickets(accessToken: string): Promise<MyTicketsResponse> {
  return apiFetch<MyTicketsResponse>('/api/my-tickets', {}, accessToken);
}

// ── RSVP ────────────────────────────────────────────────────
export function rsvpToEvent(
  eventId: string,
  accessToken: string,
): Promise<{ success: boolean; rsvp: RSVP }> {
  return apiFetch<{ success: boolean; rsvp: RSVP }>(
    '/api/rsvp',
    { method: 'POST', body: JSON.stringify({ eventId }) },
    accessToken,
  );
}

export function cancelRsvp(eventId: string, accessToken: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/api/rsvp/${eventId}`, { method: 'DELETE' }, accessToken);
}

export function getRsvp(eventId: string, accessToken: string): Promise<{ rsvp: RSVP | null }> {
  return apiFetch<{ rsvp: RSVP | null }>(`/api/rsvp/${eventId}`, {}, accessToken);
}

// ── Event Attendees ──────────────────────────────────────────
export function getEventAttendees(
  eventId: string,
  signal?: AbortSignal,
): Promise<{ attendees: Profile[]; total: number }> {
  return apiFetch<{ attendees: Profile[]; total: number }>(
    `/api/events/${eventId}/attendees`,
    {},
    undefined,
    signal,
  );
}

// ── Community ────────────────────────────────────────────────
export function getCommunityPosts(
  accessToken?: string,
  signal?: AbortSignal,
): Promise<CommunityPostsResponse> {
  return apiFetch<CommunityPostsResponse>('/api/community-posts', {}, accessToken, signal);
}

export function createCommunityPost(content: string, accessToken: string): Promise<CommunityPost> {
  return apiFetch<CommunityPost>(
    '/api/community-posts',
    { method: 'POST', body: JSON.stringify({ content }) },
    accessToken,
  );
}

export function amenPost(
  postId: string,
  accessToken: string,
): Promise<{ amened: boolean; amen_count: number }> {
  return apiFetch<{ amened: boolean; amen_count: number }>(
    `/api/community-posts/${postId}/amen`,
    { method: 'POST' },
    accessToken,
  );
}

export function getCommunityReplies(
  postId: string,
  accessToken?: string,
  signal?: AbortSignal,
): Promise<{ replies: import('./types').CommunityReply[] }> {
  return apiFetch<{ replies: import('./types').CommunityReply[] }>(
    `/api/community-posts/${postId}/replies`,
    {},
    accessToken,
    signal,
  );
}

export function createCommunityReply(
  postId: string,
  content: string,
  accessToken: string,
): Promise<import('./types').CommunityReply> {
  return apiFetch<import('./types').CommunityReply>(
    `/api/community-posts/${postId}/replies`,
    { method: 'POST', body: JSON.stringify({ content }) },
    accessToken,
  );
}

// ── Profile ──────────────────────────────────────────────────
export function getProfile(accessToken: string, signal?: AbortSignal): Promise<Profile> {
  return apiFetch<Profile>('/api/profile', {}, accessToken, signal);
}

export function updateProfile(updates: Partial<Profile>, accessToken: string): Promise<Profile> {
  return apiFetch<Profile>(
    '/api/profile',
    { method: 'PATCH', body: JSON.stringify(updates) },
    accessToken,
  );
}

export function getPublicProfile(userId: string, accessToken?: string): Promise<Profile> {
  return apiFetch<Profile>(`/api/profile/public/${userId}`, {}, accessToken);
}

// ── Upload ───────────────────────────────────────────────────
export function uploadAvatar(dataUrl: string, accessToken: string): Promise<{ url: string }> {
  return apiFetch<{ url: string }>(
    '/api/upload-avatar',
    { method: 'POST', body: JSON.stringify({ dataUrl }) },
    accessToken,
  );
}

export function uploadEventImage(
  dataUrl: string,
  type: 'cover' | 'gallery',
  accessToken: string,
): Promise<{ url: string }> {
  return apiFetch<{ url: string }>(
    '/api/upload-event-image',
    { method: 'POST', body: JSON.stringify({ dataUrl, type }) },
    accessToken,
  );
}

// ── Ticket Types ─────────────────────────────────────────────
export function createTicketType(
  payload: { event_id: string; name: string; price_cents: number; quantity?: number },
  accessToken: string,
): Promise<TicketType> {
  return apiFetch<TicketType>(
    '/api/ticket-types',
    { method: 'POST', body: JSON.stringify(payload) },
    accessToken,
  );
}

// ── Follow ───────────────────────────────────────────────────
export function followUser(
  userId: string,
  accessToken: string,
): Promise<{ following: boolean }> {
  return apiFetch<{ following: boolean }>(`/api/follow/${userId}`, { method: 'POST' }, accessToken);
}

export function unfollowUser(
  userId: string,
  accessToken: string,
): Promise<{ following: boolean }> {
  return apiFetch<{ following: boolean }>(
    `/api/follow/${userId}`,
    { method: 'DELETE' },
    accessToken,
  );
}

// ── Push Tokens ──────────────────────────────────────────────
export function registerPushToken(token: string, accessToken: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(
    '/api/push-token',
    { method: 'POST', body: JSON.stringify({ token }) },
    accessToken,
  );
}
