import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { configureApi } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { StorageService } from '../src/modules/storage/storage.service';

// 1x1 PNG
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

describe('Social + admin (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  const stamp = Date.now();
  const mk = (name: string) => ({ id: randomUUID(), email: `social-${name}-${stamp}@example.com`, name });
  const alice = mk('alice');
  const bob = mk('bob');
  const boss = mk('boss');
  const tokens: Record<string, string> = {};
  const auth = (u: { id: string }) => ({ Authorization: `Bearer ${tokens[u.id]}` });
  const putKeys: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApi(moduleRef.createNestApplication<NestExpressApplication>({ rawBody: true }));
    await app.init();
    prisma = app.get(PrismaService);
    const storage = app.get(StorageService);
    // No R2 in tests: keep validation, skip the network write
    jest.spyOn(storage as unknown as { put: (k: string) => Promise<void> }, 'put').mockImplementation(async (k: string) => {
      putKeys.push(k);
    });
    jest.spyOn(storage, 'signedGetUrl').mockImplementation(async (k: string) => `https://signed.example/${k}`);
    const jwt = app.get(JwtService);
    for (const u of [alice, bob, boss]) {
      await prisma.users.create({ data: { id: u.id, email: u.email } });
      await prisma.profiles.create({
        data: { id: u.id, email: u.email, full_name: u.name, role: u === boss ? 'admin' : 'attendee' },
      });
      tokens[u.id] = jwt.sign({ sub: u.id, email: u.email });
    }
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await prisma.users.deleteMany({ where: { id: { in: [alice.id, bob.id, boss.id] } } });
    await prisma.listing_promo_codes.deleteMany({ where: { code: `E2E${stamp}` } });
    await app.close();
  });

  it('profile: get, patch (whitelist), public views, stats', async () => {
    const me = await http.get('/api/profile').set(auth(alice)).expect(200);
    expect(me.body).toMatchObject({ id: alice.id, full_name: 'alice', host_stripe_accounts: [], followers_count: 0, following_count: 0 });

    const patched = await http
      .patch('/api/profile')
      .set(auth(alice))
      .send({ bio: 'Hi', role: 'admin', connect_tags: ['worship'] })
      .expect(200);
    expect(patched.body).toMatchObject({ bio: 'Hi', role: 'attendee', connect_tags: ['worship'] });
    await http.patch('/api/profile').set(auth(alice)).send({ city: 5 }).expect(400, { error: 'city must be text.' });

    const guest = await http.get(`/api/profile/public/${alice.id}`).expect(200);
    expect(guest.body).toEqual({
      id: alice.id, full_name: 'alice', avatar_url: null, avatar_color: null, banner_url: null,
      restricted: true, followers_count: 0, following_count: 0,
    });
    const full = await http.get(`/api/profile/public/${alice.id}`).set(auth(bob)).expect(200);
    expect(full.body).toMatchObject({ bio: 'Hi', is_following: false, prayer_supporters: [] });
    expect(full.body.email).toBeUndefined();

    await http.get('/api/profiles/not-a-uuid').expect(404, { error: 'Profile not found.' });
    const card = await http.get(`/api/profiles/${alice.id}`).expect(200);
    expect(card.body).toMatchObject({ id: alice.id, bio: 'Hi' });
    await http.get(`/api/profiles/${alice.id}/stats`).expect(200, { eventsHosted: 0, totalAttendees: 0, isVerified: false });
  });

  it('follows and prayer support', async () => {
    await http.post(`/api/follow/${bob.id}`).set(auth(bob)).expect(400, { error: 'Cannot follow yourself.' });
    await http.post(`/api/follow/${bob.id}`).set(auth(alice)).expect(200, { following: true });
    await http.post(`/api/follow/${bob.id}`).set(auth(alice)).expect(200, { following: true }); // idempotent
    await http.post(`/api/follow/${randomUUID()}`).set(auth(alice)).expect(404);

    const mine = await http.get('/api/followers').set(auth(bob)).expect(200);
    expect(mine.body).toEqual({ followers: [{ id: alice.id, full_name: 'alice', avatar_url: null, avatar_color: null }] });
    const of = await http.get(`/api/followers/${bob.id}`).expect(200);
    expect(of.body.users).toEqual([expect.objectContaining({ id: alice.id, city: null, role: 'attendee' })]);
    const following = await http.get(`/api/following/${alice.id}`).expect(200);
    expect(following.body.users.map((u: { id: string }) => u.id)).toEqual([bob.id]);
    const pub = await http.get(`/api/profile/public/${bob.id}`).set(auth(alice)).expect(200);
    expect(pub.body).toMatchObject({ followers_count: 1, is_following: true });

    await http.delete(`/api/follow/${bob.id}`).set(auth(alice)).expect(200, { following: false });
    expect((await http.get('/api/followers').set(auth(bob))).body).toEqual({ followers: [] });

    const on = await http.post('/api/profile/prayer-support').set(auth(alice)).send({ target_user_id: bob.id }).expect(200);
    expect(on.body).toEqual({ prayer_supporters: [alice.id], supporting: true });
    const off = await http.post('/api/profile/prayer-support').set(auth(alice)).send({ userId: bob.id }).expect(200);
    expect(off.body).toEqual({ prayer_supporters: [], supporting: false });
    await http.post('/api/profile/prayer-support').set(auth(alice)).send({}).expect(400, { error: 'target_user_id required' });
  });

  it('community posts, amen, replies, notifications, blocks, post type', async () => {
    await http.post('/api/community-posts').set(auth(alice)).send({ body: '  <b></b> ' }).expect(400, { error: 'Post body required.' });
    const created = await http.post('/api/community-posts').set(auth(alice)).send({ body: '<i>Praise</i> God', content: 'x' }).expect(200);
    const post = created.body;
    expect(post).toMatchObject({
      author_id: alice.id, body: 'Praise God', amen_count: 0, reply_count: 0, post_type: null,
      profiles: { id: alice.id, full_name: 'alice', avatar_url: null, avatar_color: null },
    });

    await http.patch(`/api/community-posts/${post.id}`).set(auth(bob)).send({ body: 'hack' }).expect(403, { error: 'Not your post.' });
    const edited = await http.patch(`/api/community-posts/${post.id}`).set(auth(alice)).send({ body: 'Praise Him' }).expect(200);
    expect(edited.body).toMatchObject({ body: 'Praise Him', profiles: { id: alice.id } });

    await http.patch(`/api/community-posts/${post.id}/type`).set(auth(alice)).send({ type: 'nope' }).expect(400, { error: 'Unknown post type' });
    await http.patch(`/api/community-posts/${post.id}/type`).set(auth(bob)).send({ type: 'praise' }).expect(403);
    await http.patch(`/api/community-posts/${post.id}/type`).set(auth(alice)).send({ type: 'praise' }).expect(200, { success: true });

    await http.post(`/api/community-posts/${post.id}/amen`).set(auth(bob)).expect(200, { amen_count: 1, has_amened: true, amened: true });
    await http.post(`/api/community-posts/${post.id}/amen`).set(auth(bob)).expect(200, { amen_count: 0, has_amened: false, amened: false });
    await http.post(`/api/community-posts/${post.id}/amen`).set(auth(bob)).expect(200);

    const feedGuest = await http.get('/api/community-posts?limit=5').expect(200);
    const mine = feedGuest.body.posts.find((p: { id: string }) => p.id === post.id);
    expect(mine).toMatchObject({ post_type: 'praise', amen_count: 1, has_amened: false, profiles: { full_name: 'alice' } });
    const feedBob = await http.get('/api/community-posts').set(auth(bob)).expect(200);
    expect(feedBob.body.posts.find((p: { id: string }) => p.id === post.id).has_amened).toBe(true);

    await http.post(`/api/community-posts/${post.id}/replies`).set(auth(bob)).send({ body: 'x'.repeat(501) }).expect(400, {
      error: 'Reply must be 500 characters or less.',
    });
    await http.post(`/api/community-posts/${randomUUID()}/replies`).set(auth(bob)).send({ body: 'hi' }).expect(404, { error: 'Post not found.' });
    const reply = (await http.post(`/api/community-posts/${post.id}/replies`).set(auth(bob)).send({ body: 'Amen!' }).expect(200)).body;
    expect(reply).toMatchObject({ post_id: post.id, author_id: bob.id, body: 'Amen!', amen_count: 0, profiles: { full_name: 'bob' } });

    const notes = await http.get('/api/notifications').set(auth(alice)).expect(200);
    expect(notes.body.notifications[0]).toMatchObject({ type: 'community_reply', title: 'bob replied to your post', read: false });
    await http.post('/api/notifications/read-all').set(auth(alice)).expect(200, { success: true });
    await http.patch('/api/notifications/read-all').set(auth(alice)).expect(200, { success: true });
    expect((await http.get('/api/notifications').set(auth(alice))).body.notifications[0].read).toBe(true);

    await http.post(`/api/community-replies/${reply.id}/amen`).set(auth(alice)).expect(200, { amen_count: 1, has_amened: true, amened: true });
    const replies = await http.get(`/api/community-posts/${post.id}/replies`).set(auth(alice)).expect(200);
    expect(replies.body.replies).toEqual([expect.objectContaining({ id: reply.id, has_amened: true, amen_count: 1 })]);
    expect((await prisma.community_posts.findUnique({ where: { id: post.id } }))?.reply_count).toBe(1);

    // Blocked authors disappear from the blocker's feed and replies
    await prisma.blocks.create({ data: { blocker_id: alice.id, blocked_id: bob.id } });
    expect((await http.get(`/api/community-posts/${post.id}/replies`).set(auth(alice))).body.replies).toEqual([]);
    expect((await http.get(`/api/community-posts/${post.id}/replies`)).body.replies).toHaveLength(1);

    await http.delete(`/api/community-posts/${post.id}/replies/${reply.id}`).set(auth(alice)).expect(403, { error: 'Not your reply.' });
    await http.delete(`/api/community-posts/${post.id}/replies/${reply.id}`).set(auth(bob)).expect(200, { ok: true });
    expect((await prisma.community_posts.findUnique({ where: { id: post.id } }))?.reply_count).toBe(0);

    await http.delete(`/api/community-posts/${post.id}`).set(auth(bob)).expect(403);
    await http.delete(`/api/community-posts/${post.id}`).set(auth(alice)).expect(200, { ok: true });
    await http.delete(`/api/community-posts/${post.id}`).set(auth(alice)).expect(404, { error: 'Post not found.' });
  });

  it('uploads and identity verification through admin review', async () => {
    const av = await http.post('/api/upload-avatar').set(auth(alice)).send({ dataUrl: PNG }).expect(200);
    expect(av.body.url).toMatch(new RegExp(`/avatars/${alice.id}/[0-9a-f-]+\\.png$`));
    const bn = await http.post('/api/upload-banner').set(auth(alice)).send({ dataUrl: PNG }).expect(200);
    expect(bn.body.url).toMatch(new RegExp(`/banners/${alice.id}/`));
    await http.post('/api/upload-avatar').set(auth(alice)).send({ dataUrl: 'nope' }).expect(400, { error: 'Invalid image data.' });

    await http.get('/api/identity/status').set(auth(alice)).expect(200, { verification: null });
    await http.post('/api/identity/submit').set(auth(alice)).send({ id_doc_base64: PNG }).expect(400, { error: 'Legal name is required.' });
    await http.post('/api/identity/submit').set(auth(alice)).send({ legal_name: 'Alice Smith', id_doc_base64: PNG }).expect(200, { success: true });
    expect(putKeys.at(-1)).toMatch(new RegExp(`^private/id-docs/${alice.id}/`));
    const status = await http.get('/api/identity/status').set(auth(alice)).expect(200);
    expect(status.body.verification).toMatchObject({ status: 'pending', legal_name: 'Alice Smith', verified_at: null });
    expect((await prisma.profiles.findUnique({ where: { id: alice.id } }))?.full_name).toBe('Alice Smith');

    await http.get('/api/admin/verifications').set(auth(alice)).expect(403, { error: 'Admin access required.' });
    const list = await http.get('/api/admin/verifications?status=pending').set(auth(boss)).expect(200);
    expect(list.body.verifications.find((v: { user_id: string }) => v.user_id === alice.id)).toMatchObject({
      status: 'pending',
      profiles: { full_name: 'Alice Smith', email: alice.email, avatar_url: null, avatar_color: null },
    });
    const doc = await http.get(`/api/admin/verifications/${alice.id}/id-doc`).set(auth(boss)).expect(200);
    expect(doc.body.url).toMatch(/^https:\/\/signed\.example\/private\/id-docs\//);
    await http.get(`/api/admin/verifications/${bob.id}/id-doc`).set(auth(boss)).expect(404, { error: 'No ID document found.' });

    await http.post(`/api/admin/verifications/${alice.id}/reject`).set(auth(boss)).send({ reason: 'Blurry' }).expect(200, { success: true });
    expect((await http.get('/api/identity/status').set(auth(alice))).body.verification).toMatchObject({ status: 'rejected', rejected_reason: 'Blurry' });
    await http.patch(`/api/admin/verifications/${alice.id}/approve`).set(auth(boss)).expect(200, { success: true });
    expect(await prisma.profiles.findUnique({ where: { id: alice.id } })).toMatchObject({ identity_verified: true });
    const notes = await prisma.notifications.findMany({ where: { user_id: alice.id, type: 'verification' }, orderBy: { created_at: 'asc' } });
    expect(notes.map((n) => n.title)).toEqual(['Identity verification declined', 'Identity verified']);
  });

  it('admin dashboards, users, posts, promo codes, events, stripe disconnect', async () => {
    await http.get('/api/admin/overview').expect(401);
    const ov = await http.get('/api/admin/overview').set(auth(boss)).expect(200);
    expect(ov.body).toEqual({
      total_users: expect.any(Number), published_events: expect.any(Number), total_events: expect.any(Number),
      total_revenue_cents: expect.any(Number), total_tickets_sold: expect.any(Number), total_rsvps: expect.any(Number),
    });
    const su = await http.get('/api/admin/signups').set(auth(boss)).expect(200);
    expect(su.body.data[0]).toEqual({ day: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), signups: expect.any(Number) });
    for (const [path, key] of [['revenue', 'data'], ['events-by-type', 'data'], ['top-events', 'events'], ['top-hosts', 'hosts']]) {
      const res = await http.get(`/api/admin/${path}`).set(auth(boss)).expect(200);
      expect(Array.isArray(res.body[key])).toBe(true);
    }

    // An event + confirmed ticket for the views and activity feed
    const ev = await prisma.events.create({ data: { host_id: bob.id, name: 'E2E Gala', status: 'published', event_type: 'Worship' } });
    const tt = await prisma.ticket_types.create({ data: { event_id: ev.id, name: 'GA', price_cents: 1000 } });
    await prisma.tickets.create({
      data: {
        event_id: ev.id, ticket_type_id: tt.id, user_id: alice.id, quantity: 2, unit_price_cents: 1000,
        total_charged_cents: 2140, platform_fee_cents: 140, stripe_fee_cents: 92, host_receives_cents: 1908,
        status: 'confirmed', confirmed_at: new Date(),
      },
    });
    const top = await http.get('/api/admin/top-hosts').set(auth(boss)).expect(200);
    expect(top.body.hosts.find((h: { id: string }) => h.id === bob.id)).toMatchObject({ events_created: 1, tickets_sold: 1, host_revenue_cents: 1908 });
    const act = await http.get('/api/admin/activity').set(auth(boss)).expect(200);
    expect(act.body.activity.map((a: { text: string }) => a.text)).toEqual(
      expect.arrayContaining(['bob created "E2E Gala"', 'Alice Smith bought 2 tickets for "E2E Gala"']),
    );
    expect((await http.get(`/api/profiles/${bob.id}/stats`)).body).toEqual({ eventsHosted: 1, totalAttendees: 1, isVerified: false });

    await http.patch(`/api/admin/events/${ev.id}/cancel`).set(auth(boss)).expect(200, { success: true });
    expect((await prisma.events.findUnique({ where: { id: ev.id } }))?.status).toBe('cancelled');
    await http.delete(`/api/admin/events/${ev.id}`).set(auth(boss)).expect(200, { success: true });
    expect(await prisma.events.findUnique({ where: { id: ev.id } })).toBeNull();

    await prisma.host_stripe_accounts.create({ data: { user_id: bob.id, stripe_account_id: `acct_e2e${stamp}` } });
    const users = await http.get(`/api/admin/users?q=${encodeURIComponent(bob.email)}`).set(auth(boss)).expect(200);
    expect(users.body.users).toEqual([expect.objectContaining({ id: bob.id, stripe_account_id: `acct_e2e${stamp}` })]);
    expect(users.body.users[0].host_stripe_accounts).toBeUndefined();
    await http.delete(`/api/admin/connect-disconnect/${bob.id}`).set(auth(boss)).expect(200, { success: true });
    expect(await prisma.host_stripe_accounts.findUnique({ where: { user_id: bob.id } })).toBeNull();

    await http.patch(`/api/admin/users/${bob.id}/role`).set(auth(boss)).send({ role: 'king' }).expect(400, { error: 'Invalid role.' });
    await http.patch(`/api/admin/users/${boss.id}/role`).set(auth(boss)).send({ role: 'host' }).expect(400, {
      error: 'Cannot change your own admin role.',
    });
    await http.patch(`/api/admin/users/${bob.id}/role`).set(auth(boss)).send({ role: 'host' }).expect(200, { success: true });

    const p = await prisma.community_posts.create({ data: { author_id: bob.id, body: 'spam' } });
    const posts = await http.get('/api/admin/posts?limit=500').set(auth(boss)).expect(200);
    expect(posts.body.posts.find((x: { id: string }) => x.id === p.id)).toMatchObject({ profiles: { full_name: 'bob' } });
    await http.delete(`/api/admin/posts/${p.id}`).set(auth(boss)).expect(200, { success: true });

    await http.post('/api/admin/listing-promo-codes').set(auth(boss)).send({ code: 'x' }).expect(400, {
      error: 'code, discount_type and discount_value are required.',
    });
    await http.post('/api/admin/listing-promo-codes').set(auth(boss)).send({ code: 'x', discount_type: 'percent', discount_value: 150 }).expect(400, {
      error: 'Percent discount cannot exceed 100.',
    });
    const promo = await http
      .post('/api/admin/listing-promo-codes')
      .set(auth(boss))
      .send({ code: ` e2e${stamp} `, discount_type: 'percent', discount_value: '25', max_uses: '10' })
      .expect(200);
    expect(promo.body.code).toMatchObject({ code: `E2E${stamp}`, discount_value: 25, max_uses: 10, uses_count: 0, active: true });
    await http.post('/api/admin/listing-promo-codes').set(auth(boss)).send({ code: `E2E${stamp}`, discount_type: 'fixed', discount_value: 5 }).expect(400);
    await http.patch(`/api/admin/listing-promo-codes/${promo.body.code.id}`).set(auth(boss)).send({ active: false }).expect(200, { success: true });
    const codes = await http.get('/api/admin/listing-promo-codes').set(auth(boss)).expect(200);
    expect(codes.body.codes.find((c: { id: string }) => c.id === promo.body.code.id)).toMatchObject({ active: false, discount_value: 25 });
  });
});
