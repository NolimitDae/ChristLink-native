import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { configureApi } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { StorageService } from '../src/modules/storage/storage.service';
import { publishDueEvents } from '../src/modules/events/event-helpers';

describe('Events, RSVP and forum (e2e)', () => {
  let app: NestExpressApplication;
  let http: ReturnType<typeof request>;
  let prisma: PrismaService;
  const users: Record<string, { id: string; auth: string }> = {};

  async function makeUser(key: string, city: string | null = 'Austin') {
    const id = randomUUID();
    const email = `events-e2e+${key}-${id}@example.com`;
    await prisma.users.create({ data: { id, email } });
    await prisma.profiles.create({ data: { id, email, full_name: `User ${key}`, city } });
    const token = await app.get(JwtService).signAsync({ sub: id, email });
    users[key] = { id, auth: `Bearer ${token}` };
  }
  const as = (key: string) => ({ Authorization: users[key].auth });

  async function waitForNotification(userId: string, type: string) {
    for (let i = 0; i < 40; i++) {
      const n = await prisma.notifications.findFirst({ where: { user_id: userId, type } });
      if (n) return n;
      await new Promise((r) => setTimeout(r, 50));
    }
    return null;
  }

  beforeAll(async () => {
    // No network in tests: geocoding finds nothing
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('[]'));
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApi(moduleRef.createNestApplication<NestExpressApplication>({ rawBody: true }));
    await app.init();
    prisma = app.get(PrismaService);
    http = request(app.getHttpServer());
    for (const k of ['host', 'friend', 'stranger', 'follower']) await makeUser(k);
    // friend ⇄ stranger? no: friend and follower are mutual friends; follower follows host
    await prisma.user_follows.createMany({
      data: [
        { follower_id: users.friend.id, following_id: users.follower.id },
        { follower_id: users.follower.id, following_id: users.friend.id },
        { follower_id: users.follower.id, following_id: users.host.id },
      ],
    });
  });

  afterAll(async () => {
    await prisma.users.deleteMany({ where: { email: { startsWith: 'events-e2e+' } } });
    await app.close();
  });

  let eventId: string;
  let ticketTypeId: string;

  it('creates, edits, lists and publishes an event', async () => {
    await http.post('/api/events').send({ name: 'x' }).expect(401);
    await http.post('/api/events').set(as('host')).send({}).expect(400, { error: 'Event name is required.' });
    await http.post('/api/events').set(as('host')).send({ name: 'x', max_capacity: 'many' }).expect(400);

    const start = new Date(Date.now() + 7 * 864e5).toISOString();
    const created = await http
      .post('/api/events')
      .set(as('host'))
      .send({ name: '<b>Worship Night</b>', city: 'Austin', start_date: start, max_capacity: '2', tags: ['worship'] })
      .expect(200);
    expect(created.body).toMatchObject({ name: 'Worship Night', status: 'draft', format: 'in_person', forum_enabled: true, max_capacity: 2 });
    eventId = created.body.id;
    expect((await prisma.profiles.findUnique({ where: { id: users.host.id } }))?.role).toBe('host');

    await http.patch(`/api/events/${eventId}`).set(as('stranger')).send({ name: 'Mine' }).expect(404, { error: 'Event not found or not yours.' });
    await http.patch(`/api/events/${eventId}`).set(as('host')).send({ host_id: users.stranger.id }).expect(400, { error: 'No fields to update.' });
    const patched = await http.patch(`/api/events/${eventId}`).set(as('host')).send({ description: 'Come', listing_fee_paid: true }).expect(200);
    expect(patched.body).toMatchObject({ description: 'Come', listing_fee_paid: false, host_id: users.host.id });

    let list = await http.get('/api/events?q=worship').expect(200);
    expect(list.body.events.find((e: { id: string }) => e.id === eventId)).toBeUndefined();

    await http.patch(`/api/events/${eventId}/publish`).set(as('host')).expect(200);
    await http.patch(`/api/events/${eventId}/publish`).set(as('host')).expect(400, { error: 'Only draft events can be published.' });
    const n = await waitForNotification(users.follower.id, 'new_event');
    expect(n).toMatchObject({ title: 'User host posted a new event', body: 'Worship Night', data: { eventId } });

    list = await http.get('/api/events?q=WORSHIP&city=aus').expect(200);
    const ev = list.body.events.find((e: { id: string }) => e.id === eventId);
    expect(ev).toMatchObject({ host_name: 'User host', host_avatar: null, ticket_types: [], confirmed_rsvps: 0, status: 'published', tags: ['worship'] });
    expect((await http.get('/api/events?lat=30.27&lng=-97.74').expect(200)).body.events.find((e: { id: string }) => e.id === eventId)).toBeUndefined();

    await http.get('/api/events/not-a-uuid').expect(404, { error: 'Event not found.' });
    await http.get(`/api/events/${randomUUID()}`).expect(404, { error: 'Event not found.' });
  });

  it('ticket types: create, edit, refuse unsafe edits after sales', async () => {
    await http.post('/api/ticket-types').set(as('host')).send({ event_id: eventId, name: 'GA' }).expect(400, { error: 'event_id, name, price_cents required.' });
    await http.post('/api/ticket-types').set(as('stranger')).send({ event_id: eventId, name: 'GA', price_cents: 1000 }).expect(403, { error: 'Not your event.' });
    const tt = await http.post('/api/ticket-types').set(as('host')).send({ event_id: eventId, name: 'GA', price_cents: 1000, quantity: 10 }).expect(200);
    expect(tt.body).toMatchObject({ name: 'GA', price_cents: 1000, quantity: 10, sold: 0 });
    ticketTypeId = tt.body.id;

    await http.patch(`/api/ticket-types/${ticketTypeId}`).set(as('stranger')).send({ quantity: 5 }).expect(403);
    const edited = await http.patch(`/api/ticket-types/${ticketTypeId}`).set(as('host')).send({ price_cents: 1500, sort_order: 2 }).expect(200);
    expect(edited.body).toMatchObject({ price_cents: 1500, sort_order: 2 });

    await prisma.ticket_types.update({ where: { id: ticketTypeId }, data: { sold: 3 } });
    await http.patch(`/api/ticket-types/${ticketTypeId}`).set(as('host')).send({ quantity: 2 })
      .expect(400, { error: "Quantity can't be lower than the 3 tickets already sold." });
    await http.patch(`/api/ticket-types/${ticketTypeId}`).set(as('host')).send({ price_cents: 900 })
      .expect(400, { error: "Price can't change after tickets have sold." });
    await http.patch(`/api/ticket-types/${ticketTypeId}`).set(as('host')).send({ quantity: 3, name: 'General' }).expect(200);

    const detail = await http.get(`/api/events/${eventId}`).expect(200);
    expect(detail.body.ticket_types).toEqual([expect.objectContaining({ id: ticketTypeId, name: 'General', sold: 3 })]);
  });

  it('coupons', async () => {
    await http.get(`/api/events/${eventId}/coupons`).set(as('stranger')).expect(403, { error: 'Not your event.' });
    const c = await http.post(`/api/events/${eventId}/coupons`).set(as('host')).send({ code: ' save10 ', discount_type: 'percent', discount_value: 10 }).expect(200);
    expect(c.body).toMatchObject({ code: 'SAVE10', active: true, uses: 0 });
    await http.post(`/api/events/${eventId}/coupons`).set(as('host')).send({ code: 'bad', discount_type: 'weird', discount_value: 1 }).expect(400);
    expect((await http.get(`/api/events/${eventId}/coupons`).set(as('host')).expect(200)).body.coupons).toHaveLength(1);
    const v = await http.post(`/api/events/${eventId}/validate-coupon`).send({ code: 'save10', ticketPriceCents: 1500, qty: 2 }).expect(200);
    expect(v.body).toMatchObject({ valid: true, discountCents: 300, newTotal: 2700, label: '10% off' });
    await http.delete(`/api/events/${eventId}/coupons/${c.body.id}`).set(as('stranger')).expect(403, { error: 'Not your coupon.' });
    await http.delete(`/api/events/${eventId}/coupons/${c.body.id}`).set(as('host')).expect(200, { success: true });
    await http.post(`/api/events/${eventId}/validate-coupon`).send({ code: 'SAVE10' }).expect(404, { error: 'Invalid coupon code.' });
  });

  it('RSVP notifies mutual friends once and enforces capacity', async () => {
    await http.post('/api/rsvp').set(as('friend')).send({}).expect(400, { error: 'Event ID required.' });
    const r = await http.post('/api/rsvp').set(as('friend')).send({ eventId }).expect(200);
    expect(r.body).toMatchObject({ success: true, rsvp: { event_id: eventId, user_id: users.friend.id, status: 'confirmed' } });
    const n = await waitForNotification(users.follower.id, 'friend_rsvp');
    expect(n).toMatchObject({ title: 'User friend is going to Worship Night', data: { eventId, friendId: users.friend.id } });
    expect(await prisma.notifications.count({ where: { user_id: users.stranger.id, type: 'friend_rsvp' } })).toBe(0);

    await http.get(`/api/rsvp/${eventId}`).set(as('friend')).expect(200, { rsvp: { id: r.body.rsvp.id, status: 'confirmed' } });
    await http.get(`/api/rsvp/${eventId}`).set(as('stranger')).expect(200, { rsvp: null });
    await http.post('/api/rsvp').set(as('stranger')).send({ eventId }).expect(200);
    await http.post('/api/rsvp').set(as('host')).send({ eventId }).expect(400, { error: 'Event is at full capacity.' });

    const mine = await http.get('/api/my-rsvps').set(as('friend')).expect(200);
    expect(mine.body.rsvps[0]).toMatchObject({ event_id: eventId, event_name: 'Worship Night', event_city: 'Austin', type: 'rsvp' });
    const myEvents = await http.get('/api/my-events').set(as('host')).expect(200);
    expect(myEvents.body.events[0]).toMatchObject({ id: eventId, attendee_count: 2, confirmed_rsvps: 2 });
  });

  it('attendees honor hide_rsvps_from_non_friends', async () => {
    await prisma.user_settings.create({ data: { user_id: users.friend.id, hide_rsvps_from_non_friends: true } });
    const ids = (res: request.Response) => res.body.attendees.map((a: { id: string }) => a.id).sort();
    const anon = await http.get(`/api/events/${eventId}/attendees`).expect(200);
    expect(ids(anon)).toEqual([users.stranger.id]);
    expect(anon.body.total).toBe(1);
    expect(ids(await http.get(`/api/events/${eventId}/attendees`).set(as('stranger')))).toEqual([users.stranger.id]);
    expect(ids(await http.get(`/api/events/${eventId}/attendees`).set(as('follower')))).toEqual([users.friend.id, users.stranger.id].sort());
    expect(ids(await http.get(`/api/events/${eventId}/attendees`).set(as('friend')))).toEqual([users.friend.id, users.stranger.id].sort());
    const host = await http.get(`/api/events/${eventId}/attendees`).set(as('host')).expect(200);
    expect(ids(host)).toEqual([users.friend.id, users.stranger.id].sort());
    expect(host.body.attendees[0]).toEqual(expect.objectContaining({ full_name: expect.any(String), avatar_color: null, tiktok_url: null }));

    await http.delete(`/api/rsvp/${eventId}`).set(as('stranger')).expect(200, { success: true });
    expect((await http.get(`/api/events/${eventId}/attendees`)).body).toEqual({ attendees: [], total: 0 });
  });

  it('forum: post, notify host, list with profiles, delete own only', async () => {
    await http.post(`/api/events/${eventId}/forum`).set(as('friend')).send({ content: '  ' }).expect(400, { error: 'Message content or image required.' });
    const p = await http.post(`/api/events/${eventId}/forum`).set(as('friend')).send({ content: ' See you there ' }).expect(200);
    expect(Object.keys(p.body).sort()).toEqual(['content', 'created_at', 'id', 'image_url', 'message_type', 'user_id']);
    expect(p.body).toMatchObject({ content: 'See you there', message_type: 'text', image_url: null });
    const n = await waitForNotification(users.host.id, 'forum_reply');
    expect(n).toMatchObject({ title: 'User friend posted in Worship Night', body: 'See you there', data: { eventId } });
    await http.post(`/api/events/${eventId}/forum`).set(as('host')).send({ image_url: 'https://cdn/x.jpg' }).expect(200);

    const list = await http.get(`/api/events/${eventId}/forum`).set(as('stranger')).expect(200);
    expect(list.body.posts).toHaveLength(2);
    expect(list.body.posts[0]).toMatchObject({ id: p.body.id, profiles: { full_name: 'User friend', avatar_url: null, avatar_color: null } });

    await http.delete(`/api/forum/${p.body.id}`).set(as('host')).expect(403, { error: 'Not your message.' });
    await http.delete(`/api/events/${eventId}/forum/${p.body.id}`).set(as('friend')).expect(200, { success: true });
    await http.delete(`/api/forum/${p.body.id}`).set(as('friend')).expect(404, { error: 'Post not found.' });

    await prisma.events.update({ where: { id: eventId }, data: { forum_enabled: false } });
    await http.post(`/api/events/${eventId}/forum`).set(as('friend')).send({ content: 'hi' }).expect(403, { error: 'Forum disabled for this event.' });
  });

  it('sales, invite and uploads', async () => {
    await http.get(`/api/events/${eventId}/sales`).set(as('stranger')).expect(403, { error: 'Not your event.' });
    const sales = await http.get(`/api/events/${eventId}/sales`).set(as('host')).expect(200);
    expect(sales.body).toMatchObject({
      event: { id: eventId, name: 'Worship Night', host_id: users.host.id, is_paid: false },
      tickets: [],
      rsvps: [{ user_id: users.friend.id, profiles: { full_name: 'User friend', email: expect.any(String) } }],
      summary: { totalTicketsSold: 0, totalRsvps: 1, grossRevenue: 0, platformFees: 0, hostEarnings: 0 },
    });

    await http.post(`/api/events/${eventId}/invite`).set(as('host')).send({ followerIds: [] }).expect(400, { error: 'No followers selected.' });
    await http.post(`/api/events/${eventId}/invite`).set(as('stranger')).send({ followerIds: [users.friend.id] }).expect(403);
    await http.post(`/api/events/${eventId}/invite`).set(as('host')).send({ followerIds: [users.follower.id, 'bogus', randomUUID()] }).expect(200, { sent: 1 });
    expect(await waitForNotification(users.follower.id, 'event_invite')).toMatchObject({ title: 'User host invited you to an event' });

    await http.post('/api/upload-event-image').set(as('host')).send({ dataUrl: 'nope' }).expect(400, { error: 'Invalid image data.' });
    const put = jest.spyOn(app.get(StorageService), 'putDataUrl').mockResolvedValue('https://files/forum/x.jpg');
    await http.post('/api/upload-forum-image').set(as('host')).send({ dataUrl: 'data:image/jpeg;base64,/9j/' }).expect(200, { url: 'https://files/forum/x.jpg' });
    expect(put).toHaveBeenCalledWith('forum', users.host.id, 'data:image/jpeg;base64,/9j/');
  });

  it('toggle, duplicate, schedule, auto-publish and delete', async () => {
    await http.patch(`/api/events/${eventId}/toggle-visibility`).set(as('stranger')).expect(403, { error: 'Not your event.' });
    await http.patch(`/api/events/${eventId}/toggle-visibility`).set(as('host')).expect(200, { success: true, status: 'draft' });

    const dup = await http.post(`/api/events/${eventId}/duplicate`).set(as('host')).expect(200);
    expect(dup.body.event).toMatchObject({ name: 'Worship Night (Copy)', status: 'draft', listing_fee_paid: false });
    const copyTypes = await prisma.ticket_types.findMany({ where: { event_id: dup.body.event.id } });
    expect(copyTypes).toEqual([expect.objectContaining({ name: 'General', sold: 0 })]);

    const copyId = dup.body.event.id;
    await http.patch(`/api/events/${copyId}/schedule`).set(as('host')).send({ publish_at: '2000-01-01' }).expect(400, { error: 'Schedule date must be in the future.' });
    const future = new Date(Date.now() + 3600e3).toISOString();
    expect((await http.patch(`/api/events/${copyId}/schedule`).set(as('host')).send({ publish_at: future }).expect(200)).body.publish_at).toBe(future);
    await prisma.events.update({ where: { id: copyId }, data: { publish_at: new Date(Date.now() - 1000) } });
    expect(await publishDueEvents(prisma, app.get(NotificationsService))).toBeGreaterThanOrEqual(1);
    expect((await prisma.events.findUnique({ where: { id: copyId } }))?.status).toBe('published');

    await http.delete(`/api/events/${copyId}`).set(as('stranger')).expect(404);
    await http.delete(`/api/events/${copyId}`).set(as('host')).expect(200, { success: true, action: 'cancelled' });
    await http.delete(`/api/events/${eventId}`).set(as('host')).expect(200, { success: true, action: 'deleted' });
  });
});
