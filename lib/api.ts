import { API_BASE } from './constants';
import type {
  Event,
  CommunityPost,
  Profile,
  RSVP,
  Ticket,
  TicketType,
  CreateEventPayload,
  EventsResponse,
  CommunityPostsResponse,
  MyEventsResponse,
  MyRsvpsResponse,
  MyTicketsResponse,
} from './types';

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  accessToken?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error((data as { error: string }).error || `API error ${response.status}`);
  }
  return data as T;
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
}

export function getEvents(params: GetEventsParams = {}): Promise<EventsResponse> {
  const qs = new URLSearchParams();
  if (params.type && params.type !== 'All') qs.set('type', params.type);
  if (params.city) qs.set('city', params.city);
  if (params.lat !== undefined) qs.set('lat', String(params.lat));
  if (params.lng !== undefined) qs.set('lng', String(params.lng));
  if (params.radius !== undefined) qs.set('radius', String(params.radius));
  if (params.is_paid !== undefined) qs.set('is_paid', String(params.is_paid));
  if (params.q) qs.set('q', params.q);
  if (params.format) qs.set('format', params.format);
  if (params.host_id) qs.set('host_id', params.host_id);
  if (params.limit !== undefined) qs.set('limit', String(params.limit));
  if (params.offset !== undefined) qs.set('offset', String(params.offset));
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch<EventsResponse>(`/api/events${query}`);
}

export function getEvent(id: string): Promise<Event> {
  return apiFetch<Event>(`/api/events/${id}`);
}

export function createEvent(payload: CreateEventPayload, accessToken: string): Promise<Event> {
  return apiFetch<Event>('/api/events', { method: 'POST', body: JSON.stringify(payload) }, accessToken);
}

export function updateEvent(id: string, payload: Partial<CreateEventPayload>, accessToken: string): Promise<Event> {
  return apiFetch<Event>(`/api/events/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }, accessToken);
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
export function rsvpToEvent(eventId: string, accessToken: string): Promise<{ success: boolean; rsvp: RSVP }> {
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
export function getEventAttendees(eventId: string): Promise<{ attendees: Profile[]; total: number }> {
  return apiFetch<{ attendees: Profile[]; total: number }>(`/api/events/${eventId}/attendees`);
}

// ── Community ────────────────────────────────────────────────
export function getCommunityPosts(accessToken?: string): Promise<CommunityPostsResponse> {
  return apiFetch<CommunityPostsResponse>('/api/community-posts', {}, accessToken);
}

export function createCommunityPost(
  content: string,
  accessToken: string,
): Promise<CommunityPost> {
  return apiFetch<CommunityPost>(
    '/api/community-posts',
    { method: 'POST', body: JSON.stringify({ content }) },
    accessToken,
  );
}

export function amenPost(postId: string, accessToken: string): Promise<{ amened: boolean; amen_count: number }> {
  return apiFetch<{ amened: boolean; amen_count: number }>(
    `/api/community-posts/${postId}/amen`,
    { method: 'POST' },
    accessToken,
  );
}

export function getCommunityReplies(
  postId: string,
  accessToken?: string,
): Promise<{ replies: import('./types').CommunityReply[] }> {
  return apiFetch<{ replies: import('./types').CommunityReply[] }>(
    `/api/community-posts/${postId}/replies`,
    {},
    accessToken,
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
export function getProfile(accessToken: string): Promise<Profile> {
  return apiFetch<Profile>('/api/profile', {}, accessToken);
}

export function updateProfile(
  updates: Partial<Profile>,
  accessToken: string,
): Promise<Profile> {
  return apiFetch<Profile>('/api/profile', { method: 'PATCH', body: JSON.stringify(updates) }, accessToken);
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
  return apiFetch<TicketType>('/api/ticket-types', { method: 'POST', body: JSON.stringify(payload) }, accessToken);
}

// ── Follow ───────────────────────────────────────────────────
export function followUser(userId: string, accessToken: string): Promise<{ following: boolean }> {
  return apiFetch<{ following: boolean }>(`/api/follow/${userId}`, { method: 'POST' }, accessToken);
}

export function unfollowUser(userId: string, accessToken: string): Promise<{ following: boolean }> {
  return apiFetch<{ following: boolean }>(`/api/follow/${userId}`, { method: 'DELETE' }, accessToken);
}
