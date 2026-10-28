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
import * as f from '../../lib/features';

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
  ['updateTicketType', () => api.updateTicketType('tt1', { name: 'VIP', price_cents: 2500, quantity: 50, sort_order: 1 }, T), 'PATCH', '/api/ticket-types/tt1', { name: 'VIP', price_cents: 2500, quantity: 50, sort_order: 1 }],
  ['adminListVerifications', () => api.adminListVerifications(T), 'GET', '/api/admin/verifications?status=pending'],
  ['adminDecideVerification', () => api.adminDecideVerification('v1', false, T, 'blurry'), 'POST', '/api/admin/verifications/v1/reject', { reason: 'blurry' }],
  ['adminVerificationDocUrl', () => api.adminVerificationDocUrl('v1', T), 'GET', '/api/admin/verifications/v1/id-doc'],
  ['adminDeletePost', () => api.adminDeletePost('p1', T), 'DELETE', '/api/admin/posts/p1'],
  ['getWalletLink', () => api.getWalletLink('t1', T), 'GET', '/api/tickets/t1/wallet-link'],
  // Auth (email one-time code)
  ['requestSignInCode', () => api.requestSignInCode('a@b.co'), 'POST', '/api/auth/signin', { email: 'a@b.co' }],
  ['requestSignInCode+name', () => api.requestSignInCode('a@b.co', 'Ann'), 'POST', '/api/auth/signup', { email: 'a@b.co', fullName: 'Ann' }],
  ['verifySignInCode', () => api.verifySignInCode('a@b.co', '123456'), 'POST', '/api/auth/verify-otp', { email: 'a@b.co', token: '123456' }],
  ['revokeRefreshToken', () => api.revokeRefreshToken('rt'), 'POST', '/api/auth/signout', { refreshToken: 'rt' }],
  // Native features (lib/features.ts)
  ['getVerseOfTheDay', () => f.getVerseOfTheDay('Hope'), 'GET', '/api/verses/today?theme=hope'],
  ['listVerses', () => f.listVerses(), 'GET', '/api/admin/verses'],
  ['saveVerse (new)', () => f.saveVerse({ reference: 'John 3:16', text: 'For God' }), 'POST', '/api/admin/verses', { reference: 'John 3:16', text: 'For God', translation: 'WEB', themes: [], active: true }],
  ['saveVerse (edit)', () => f.saveVerse({ id: 7, reference: 'R', text: 'T', active: false }), 'PATCH', '/api/admin/verses/7', { reference: 'R', text: 'T', translation: 'WEB', themes: [], active: false }],
  ['getSettings', () => f.getSettings(), 'GET', '/api/settings'],
  ['updateSettings', () => f.updateSettings({ timezone: 'UTC' }), 'PATCH', '/api/settings', { timezone: 'UTC' }],
  ['savePushToken', () => f.savePushToken('ExponentPushToken[x]', 'ios'), 'POST', '/api/push-tokens', { token: 'ExponentPushToken[x]', platform: 'ios' }],
  ['deletePushToken', () => f.deletePushToken('tok1'), 'DELETE', '/api/push-tokens/tok1'],
  ['deleteMyAccount', () => f.deleteMyAccount(), 'DELETE', '/api/account'],
  ['getFriendsThisWeek', () => f.getFriendsThisWeek(), 'GET', '/api/friends/this-week'],
  ['getMyFriends', () => f.getMyFriends(), 'GET', '/api/friends'],
  ['getPrayerWall', () => f.getPrayerWall('friends', '2026-10-01T00:00:00Z'), 'GET', '/api/prayers?filter=friends&limit=30&before=2026-10-01T00%3A00%3A00Z'],
  ['createPrayer', () => f.createPrayer(' Pray ', true, 'c1'), 'POST', '/api/prayers', { body: 'Pray', is_anonymous: true, church_id: 'c1' }],
  ['deletePrayer', () => f.deletePrayer('p1'), 'DELETE', '/api/prayers/p1'],
  ['prayFor', () => f.prayFor('p1'), 'POST', '/api/prayers/p1/pray'],
  ['markPrayerAnswered', () => f.markPrayerAnswered('p1', 'He did'), 'POST', '/api/prayers/p1/answer', { testimony: 'He did' }],
  ['setPostType', () => f.setPostType('p1', 'testimony'), 'PATCH', '/api/community-posts/p1/type', { type: 'testimony' }],
  ['reportContent', () => f.reportContent('post', 'p1', 'spam', ' x '), 'POST', '/api/reports', { target_type: 'post', target_id: 'p1', reason: 'spam', details: 'x' }],
  ['blockUser', () => f.blockUser('u1'), 'POST', '/api/blocks', { user_id: 'u1' }],
  ['unblockUser', () => f.unblockUser('u1'), 'DELETE', '/api/blocks/u1'],
  ['getReportQueue', () => f.getReportQueue(), 'GET', '/api/admin/reports'],
  ['resolveReport', () => f.resolveReport('r1', 'remove'), 'POST', '/api/admin/reports/r1/resolve', { action: 'remove' }],
  ['searchChurches', () => f.searchChurches(' grace ', 10), 'GET', '/api/churches?q=grace&limit=10'],
  ['getChurch', () => f.getChurch('c1'), 'GET', '/api/churches/c1'],
  ['createChurch', () => f.createChurch({ name: 'Grace' }), 'POST', '/api/churches', { name: 'Grace' }],
  ['updateChurch', () => f.updateChurch('c1', { about: 'Hi' }), 'PATCH', '/api/churches/c1', { about: 'Hi' }],
  ['claimChurch', () => f.claimChurch('c1', 'Pastor', 'note'), 'POST', '/api/churches/c1/claim', { role_at_church: 'Pastor', note: 'note' }],
  ['listPendingClaims', () => f.listPendingClaims(), 'GET', '/api/admin/church-claims'],
  ['decideChurchClaim', () => f.decideChurchClaim('cl1', true), 'POST', '/api/admin/church-claims/cl1/decide', { approve: true }],
  ['getChurchRecurring', () => f.getChurchRecurring('c1'), 'GET', '/api/churches/c1/recurring'],
  ['saveRecurring (new)', () => f.saveRecurring({ church_id: 'c1', name: 'Sunday' }), 'POST', '/api/churches/c1/recurring', { church_id: 'c1', name: 'Sunday' }],
  ['saveRecurring (edit)', () => f.saveRecurring({ id: 'rc1', church_id: 'c1', name: 'Sunday' }), 'PATCH', '/api/church-recurring/rc1', { church_id: 'c1', name: 'Sunday' }],
  ['deleteRecurring', () => f.deleteRecurring('rc1'), 'DELETE', '/api/church-recurring/rc1'],
  ['getChurchEventIds', () => f.getChurchEventIds('c1'), 'GET', '/api/churches/c1/events'],
  ['linkEventToChurch', () => f.linkEventToChurch('c1', 'e1'), 'POST', '/api/churches/c1/events', { event_id: 'e1' }],
  ['isFollowingChurch', () => f.isFollowingChurch('c1'), 'GET', '/api/churches/c1/follow'],
  ['setFollowChurch (follow)', () => f.setFollowChurch('c1', true), 'POST', '/api/churches/c1/follow'],
  ['setFollowChurch (unfollow)', () => f.setFollowChurch('c1', false), 'DELETE', '/api/churches/c1/follow'],
  ['getMyManagedChurches', () => f.getMyManagedChurches(), 'GET', '/api/my-churches'],
  ['getOpenShifts', () => f.getOpenShifts({ churchId: 'c1' }), 'GET', '/api/serve/shifts?church_id=c1'],
  ['signUpForShift', () => f.signUpForShift('s1'), 'POST', '/api/serve/shifts/s1/signup'],
  ['cancelSignup', () => f.cancelSignup('su1'), 'POST', '/api/serve/signups/su1/cancel'],
  ['createServeRole', () => f.createServeRole({ name: 'Usher', shifts: [] }), 'POST', '/api/serve/roles', { name: 'Usher', shifts: [] }],
  ['getMyManagedShifts', () => f.getMyManagedShifts(), 'GET', '/api/serve/my-shifts'],
  ['getShiftRoster', () => f.getShiftRoster('s1'), 'GET', '/api/serve/shifts/s1/roster'],
  ['serveCheckIn', () => f.serveCheckIn('ABC123'), 'POST', '/api/serve/check-in', { code: 'ABC123' }],
  ['completeShift', () => f.completeShift('s1'), 'POST', '/api/serve/shifts/s1/complete'],
  ['messageVolunteers', () => f.messageVolunteers('s1', 'See you'), 'POST', '/api/serve/shifts/s1/message', { message: 'See you' }],
  ['getHoursServed', () => f.getHoursServed(), 'GET', '/api/serve/hours'],
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

  it('unwraps wrapped scalars from feature routes', async () => {
    const reply = (body: unknown) => mockFetch.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(body) });
    reply({ count: 3 });
    await expect(f.prayFor('p1')).resolves.toBe(3);
    reply({ post_id: 'pp1' });
    await expect(f.markPrayerAnswered('p1', 't')).resolves.toBe('pp1');
    reply({ hours: 4.5 });
    await expect(f.getHoursServed()).resolves.toBe(4.5);
    reply({ following: true });
    await expect(f.isFollowingChurch('c1')).resolves.toBe(true);
    reply({ id: 'role1' });
    await expect(f.createServeRole({ name: 'Usher', shifts: [] })).resolves.toBe('role1');
  });

  it('maps a missing route to a "not set up" FeatureError', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404, text: async () => JSON.stringify({ error: 'Cannot GET /api/prayers' }) });
    await expect(f.getPrayerWall()).rejects.toMatchObject({ name: 'FeatureError', notSetUp: true });
    mockFetch.mockResolvedValue({ ok: false, status: 404, text: async () => JSON.stringify({ error: 'Church not found.' }) });
    await expect(f.updateChurch('c1', {})).rejects.toMatchObject({ notSetUp: false, message: 'Church not found.' });
  });

  it('falls back softly where screens expect it', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, text: async () => '{}' });
    await expect(f.getHoursServed()).resolves.toBe(0);
    await expect(f.getVerseOfTheDay()).resolves.toHaveProperty('reference');
  });
});
