/**
 * Route contract: every native call must hit the same method + path the web app uses on the Railway API.
 * If the server renames a route, this table is the single place to update.
 */
const mockFetch = jest.fn();
global.fetch = mockFetch;

jest.mock('../../lib/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../../lib/constants', () => ({ API_BASE: 'https://api.test', API_TIMEOUT_MS: 5000, API_MAX_RETRIES: 0 }));

import * as api from '../../lib/api';

const T = 'tok';

type Case = [string, () => Promise<unknown>, string, string, unknown?];

const cases: Case[] = [
  ['createEvent', () => api.createEvent({ name: 'X', format: 'online', is_paid: false }, T), 'POST', '/api/events'],
  ['updateEvent', () => api.updateEvent('e1', { name: 'Y' }, T), 'PATCH', '/api/events/e1'],
  ['publishEvent', () => api.publishEvent('e1', T), 'PATCH', '/api/events/e1/publish'],
  ['scheduleEvent', () => api.scheduleEvent('e1', '2026-12-01T10:00:00Z', T), 'PATCH', '/api/events/e1/schedule', { publish_at: '2026-12-01T10:00:00Z' }],
  ['duplicateEvent', () => api.duplicateEvent('e1', T), 'POST', '/api/events/e1/duplicate'],
  ['toggleEventVisibility', () => api.toggleEventVisibility('e1', T), 'PATCH', '/api/events/e1/toggle-visibility'],
  ['getMyEvents', () => api.getMyEvents(T), 'GET', '/api/my-events'],
  ['getMyRsvps', () => api.getMyRsvps(T), 'GET', '/api/my-rsvps'],
  ['rsvpToEvent', () => api.rsvpToEvent('e1', T), 'POST', '/api/rsvp', { eventId: 'e1' }],
  ['cancelRsvp', () => api.cancelRsvp('e1', T), 'DELETE', '/api/rsvp/e1'],
  ['getRsvp', () => api.getRsvp('e1', T), 'GET', '/api/rsvp/e1'],
  ['getEventAttendees', () => api.getEventAttendees('e1'), 'GET', '/api/events/e1/attendees'],
  ['inviteFollowers', () => api.inviteFollowers('e1', ['u1'], T), 'POST', '/api/events/e1/invite', { followerIds: ['u1'] }],
  ['getPriceBreakdown', () => api.getPriceBreakdown(1500, 2, true), 'GET', '/api/price-breakdown?price=1500&qty=2&absorb=true'],
  ['getTaxEstimate', () => api.getTaxEstimate(1500, T), 'POST', '/api/tax-estimate', { amountCents: 1500 }],
  ['validateCoupon', () => api.validateCoupon('e1', 'FAITH10', 1500, 1), 'POST', '/api/events/e1/validate-coupon', { code: 'FAITH10', ticketPriceCents: 1500, qty: 1 }],
  ['confirmTicketByIntent', () => api.confirmTicketByIntent('pi_1', T), 'POST', '/api/tickets/confirm-by-intent', { paymentIntentId: 'pi_1' }],
  ['requestRefund', () => api.requestRefund('t1', 'sick', T), 'POST', '/api/tickets/t1/request-refund', { reason: 'sick' }],
  ['hostRefundTicket', () => api.hostRefundTicket('t1', T), 'POST', '/api/tickets/t1/refund'],
  ['validateListingPromo', () => api.validateListingPromo('LAUNCH', T), 'POST', '/api/validate-listing-promo', { code: 'LAUNCH' }],
  ['chargeListingFee', () => api.chargeListingFee({ eventId: 'e1', paymentMethodId: 'pm_1' }, T), 'POST', '/api/charge-listing-fee'],
  ['getRefundRequests', () => api.getRefundRequests('e1', T), 'GET', '/api/refund-requests?eventId=e1'],
  ['decideRefundRequest', () => api.decideRefundRequest('r1', 'approve', T), 'POST', '/api/refund-requests/r1/approve'],
  ['getAttendance', () => api.getAttendance('e1', T), 'GET', '/api/events/e1/attendance'],
  ['startConnectOnboarding', () => api.startConnectOnboarding(T), 'POST', '/api/connect-onboard'],
  ['syncConnectStatus', () => api.syncConnectStatus(T), 'POST', '/api/connect-sync'],
  ['getHostStats', () => api.getHostStats('u1'), 'GET', '/api/profiles/u1/stats'],
  ['submitIdentity', () => api.submitIdentity('Jane Doe', 'data:image/jpeg;base64,xx', T), 'POST', '/api/identity/submit', { legal_name: 'Jane Doe', id_doc_base64: 'data:image/jpeg;base64,xx' }],
  ['getIdentityStatus', () => api.getIdentityStatus(T), 'GET', '/api/identity/status'],
  ['createCommunityPost', () => api.createCommunityPost('hello', T), 'POST', '/api/community-posts'],
  ['deleteCommunityPost', () => api.deleteCommunityPost('p1', T), 'DELETE', '/api/community-posts/p1'],
  ['amenPost', () => api.amenPost('p1', T), 'POST', '/api/community-posts/p1/amen'],
  ['getCommunityReplies', () => api.getCommunityReplies('p1'), 'GET', '/api/community-posts/p1/replies'],
  ['createCommunityReply', () => api.createCommunityReply('p1', 'amen', T), 'POST', '/api/community-posts/p1/replies'],
  ['amenReply', () => api.amenReply('r1', T), 'POST', '/api/community-replies/r1/amen'],
  ['getForum', () => api.getForum('e1', T), 'GET', '/api/events/e1/forum'],
  ['postForum', () => api.postForum('e1', 'hi', T), 'POST', '/api/events/e1/forum', { content: 'hi' }],
  ['getProfile', () => api.getProfile(T), 'GET', '/api/profile'],
  ['updateProfile', () => api.updateProfile({ bio: 'x' }, T), 'PATCH', '/api/profile', { bio: 'x' }],
  ['getPublicProfile', () => api.getPublicProfile('u1'), 'GET', '/api/profile/public/u1'],
  ['supportPrayerRequest', () => api.supportPrayerRequest('u1', T), 'POST', '/api/profile/prayer-support'],
  ['getFollowers', () => api.getFollowers(T), 'GET', '/api/followers'],
  ['followUser', () => api.followUser('u1', T), 'POST', '/api/follow/u1'],
  ['unfollowUser', () => api.unfollowUser('u1', T), 'DELETE', '/api/follow/u1'],
  ['getNotifications', () => api.getNotifications(T), 'GET', '/api/notifications'],
  ['markAllNotificationsRead', () => api.markAllNotificationsRead(T), 'POST', '/api/notifications/read-all'],
  ['uploadAvatar', () => api.uploadAvatar('data:', T), 'POST', '/api/upload-avatar', { dataUrl: 'data:' }],
  ['uploadBanner', () => api.uploadBanner('data:', T), 'POST', '/api/upload-banner', { dataUrl: 'data:' }],
  ['uploadEventImage', () => api.uploadEventImage('data:', 'cover', T), 'POST', '/api/upload-event-image', { dataUrl: 'data:', type: 'cover' }],
  ['createTicketType', () => api.createTicketType({ event_id: 'e1', name: 'GA', price_cents: 1500 }, T), 'POST', '/api/ticket-types'],
  ['adminListVerifications', () => api.adminListVerifications(T), 'GET', '/api/admin/verifications?status=pending'],
  ['adminDecideVerification', () => api.adminDecideVerification('v1', false, T, 'blurry'), 'POST', '/api/admin/verifications/v1/reject', { reason: 'blurry' }],
  ['adminVerificationDocUrl', () => api.adminVerificationDocUrl('v1', T), 'GET', '/api/admin/verifications/v1/id-doc'],
  ['adminDeletePost', () => api.adminDeletePost('p1', T), 'DELETE', '/api/admin/posts/p1'],
];

describe('API route contract', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify({ event: { id: 'e1' }, sales: [] }) });
  });

  it.each(cases)('%s', async (...row) => {
    const [, call, method, path, body] = row as Case;
    await call();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe(`https://api.test${path}`);
    expect((init.method ?? 'GET').toUpperCase()).toBe(method);
    if (body !== undefined) expect(JSON.parse(String(init.body))).toEqual(body);
  });

  it('sends the bearer token on authenticated calls', async () => {
    await api.getMyTickets('secret-token');
    const init = mockFetch.mock.calls[0][1] as { headers: Record<string, string> };
    expect(init.headers.Authorization).toBe('Bearer secret-token');
  });

  it('returns tolerant defaults when list fields are missing', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, text: async () => '' });
    await expect(api.getFollowers(T)).resolves.toEqual([]);
    await expect(api.getNotifications(T)).resolves.toEqual([]);
    await expect(api.getRefundRequests('e1', T)).resolves.toEqual([]);
    await expect(api.getForum('e1')).resolves.toEqual([]);
  });

  it('turns non-JSON error pages into readable errors', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 502, text: async () => '<html>Bad gateway</html>' });
    await expect(api.getProfile(T)).rejects.toThrow('<html>Bad gateway</html>');
  });

  it('reports network failures without leaking internals', async () => {
    mockFetch.mockRejectedValue(new TypeError('Network request failed'));
    await expect(api.getProfile(T)).rejects.toThrow('Network error. Please check your connection.');
  });

  it('normalizes sales payloads', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ event: { id: 'e1', confirmed_rsvps: 4 }, summary: { totalTicketsSold: 0, totalRsvps: 4, grossRevenue: 0, hostEarnings: 0 } }),
    });
    const sales = await api.getEventSales('e1', T);
    expect(sales.event.going_count).toBe(4);
    expect(sales.tickets).toEqual([]);
    expect(sales.rsvps).toEqual([]);
  });

  it('builds the wallet pass URL without credentials', () => {
    expect(api.walletPassUrl('t1')).toBe('https://api.test/api/tickets/t1/wallet');
  });
});
