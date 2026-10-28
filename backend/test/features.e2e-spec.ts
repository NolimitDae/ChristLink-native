import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerGuard } from '@nestjs/throttler';
import { randomUUID } from 'crypto';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { configureApi } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { queuePrayerSummaries } from '../src/modules/prayers/prayers.service';

describe('Native features (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  const stamp = Date.now();
  const mk = (name: string) => ({ id: randomUUID(), email: `feat-${name}-${stamp}@example.com`, name });
  const ann = mk('ann'); // author / organizer / church owner
  const ben = mk('ben'); // friend of ann
  const cat = mk('cat'); // stranger
  const boss = mk('boss'); // admin
  const gone = mk('gone'); // deletes their account
  const host = mk('host'); // host with sales history deletes their account
  const users = [ann, ben, cat, boss, gone, host];
  const tokens: Record<string, string> = {};
  const auth = (u: { id: string }) => ({ Authorization: `Bearer ${tokens[u.id]}` });
  const churchName = `E2E Church ${stamp}`;
  const in2days = new Date(Date.now() + 2 * 86400_000);
  let eventId: string;

  beforeAll(async () => {
    jest.spyOn(ThrottlerGuard.prototype, 'canActivate').mockResolvedValue(true);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApi(moduleRef.createNestApplication<NestExpressApplication>({ rawBody: true }));
    await app.init();
    prisma = app.get(PrismaService);
    const jwt = app.get(JwtService);
    for (const u of users) {
      await prisma.users.create({ data: { id: u.id, email: u.email } });
      await prisma.profiles.create({ data: { id: u.id, email: u.email, full_name: u.name, role: u === boss ? 'admin' : 'attendee' } });
      tokens[u.id] = jwt.sign({ sub: u.id, email: u.email });
    }
    // ann <-> ben are friends (mutual follows); cat follows ann one way
    await prisma.user_follows.createMany({
      data: [
        { follower_id: ann.id, following_id: ben.id },
        { follower_id: ben.id, following_id: ann.id },
        { follower_id: cat.id, following_id: ann.id },
      ],
    });
    const ev = await prisma.events.create({ data: { host_id: ann.id, name: `E2E Event ${stamp}`, status: 'published', start_date: in2days } });
    eventId = ev.id;
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await prisma.churches.deleteMany({ where: { name: { startsWith: churchName } } });
    await prisma.events.deleteMany({ where: { host_id: { in: users.map((u) => u.id) } } });
    await prisma.users.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
    await prisma.users.deleteMany({ where: { id: host.id } });
    await prisma.verses.deleteMany({ where: { reference: `E2E ${stamp}` } });
    await app.close();
  });

  it('verses: public today, admin CRUD', async () => {
    const today = await http.get('/api/verses/today?theme=prayer').expect(200);
    expect(today.body).toEqual({ reference: expect.any(String), text: expect.any(String), translation: expect.any(String) });

    await http.get('/api/admin/verses').set(auth(ann)).expect(403);
    await http.post('/api/admin/verses').set(auth(boss)).send({ text: 'x' }).expect(400);
    const created = await http.post('/api/admin/verses').set(auth(boss)).send({ reference: `E2E ${stamp}`, text: 'Hello', themes: ['e2e'] }).expect(200);
    expect(created.body).toMatchObject({ reference: `E2E ${stamp}`, translation: 'WEB', active: true, themes: ['e2e'] });
    const upd = await http.patch(`/api/admin/verses/${created.body.id}`).set(auth(boss)).send({ active: false }).expect(200);
    expect(upd.body.active).toBe(false);
    const list = await http.get('/api/admin/verses').set(auth(boss)).expect(200);
    expect(list.body.some((v: { id: number }) => v.id === created.body.id)).toBe(true);
  });

  it('settings and push tokens', async () => {
    const empty = await http.get('/api/settings').set(auth(ann)).expect(200);
    expect(empty.body).toBeNull();
    await http.patch('/api/settings').set(auth(ann)).send({ quiet_hours_start: 30 }).expect(400);
    await http.patch('/api/settings').set(auth(ann)).send({ hide_rsvps_from_non_friends: null }).expect(400);
    const saved = await http.patch('/api/settings').set(auth(ann))
      .send({ terms_version: '2026-10-15', terms_accepted_at: new Date().toISOString(), quiet_hours_start: 22, user_id: cat.id })
      .expect(200);
    expect(saved.body).toMatchObject({ user_id: ann.id, terms_version: '2026-10-15', quiet_hours_start: 22, hide_rsvps_from_non_friends: false });
    const again = await http.patch('/api/settings').set(auth(ann)).send({ notification_prefs: { prayer: false } }).expect(200);
    expect(again.body).toMatchObject({ terms_version: '2026-10-15', notification_prefs: { prayer: false } });

    const token = `ExponentPushToken[e2e-${stamp}]`;
    await http.post('/api/push-tokens').set(auth(ann)).send({ token, platform: 'ios' }).expect(200);
    // Same device, other account: the token moves
    await http.post('/api/push-tokens').set(auth(ben)).send({ token, platform: 'ios' }).expect(200);
    expect((await prisma.push_tokens.findUnique({ where: { token } })).user_id).toBe(ben.id);
    // Only the owner can delete it
    await http.delete(`/api/push-tokens/${encodeURIComponent(token)}`).set(auth(ann)).expect(200);
    expect(await prisma.push_tokens.findUnique({ where: { token } })).not.toBeNull();
    await http.delete(`/api/push-tokens/${encodeURIComponent(token)}`).set(auth(ben)).expect(200);
    expect(await prisma.push_tokens.findUnique({ where: { token } })).toBeNull();
  });

  it('friends: mine, going, this week', async () => {
    await prisma.rsvps.create({ data: { event_id: eventId, user_id: ben.id, status: 'confirmed' } });
    const mine = await http.get('/api/friends').set(auth(ann)).expect(200);
    expect(mine.body).toEqual([{ id: ben.id, full_name: 'ben', avatar_url: null, avatar_color: null }]);
    const going = await http.post('/api/friends/going').set(auth(ann)).send({ event_ids: [eventId] }).expect(200);
    expect(going.body).toEqual([{ event_id: eventId, friend_count: 1, friends: [{ id: ben.id, full_name: 'ben', avatar_url: null, avatar_color: null }] }]);
    // cat only follows ann one way: no friends
    expect((await http.post('/api/friends/going').set(auth(cat)).send({ event_ids: [eventId] }).expect(200)).body).toEqual([]);
    await http.post('/api/friends/going').set(auth(ann)).send({ event_ids: ['nope'] }).expect(400);
    const week = await http.get('/api/friends/this-week').set(auth(ann)).expect(200);
    expect(week.body).toEqual([expect.objectContaining({ event_id: eventId, event_name: `E2E Event ${stamp}`, friends: [expect.objectContaining({ id: ben.id })] })]);
  });

  it('prayers: anonymity, pray once, answer, delete, summary', async () => {
    const anon = await http.post('/api/prayers').set(auth(ann)).send({ body: 'Please pray for my exam', is_anonymous: true }).expect(200);
    await http.post('/api/prayers').set(auth(ann)).send({ body: 'x' }).expect(400);
    const open = await http.post('/api/prayers').set(auth(ann)).send({ body: 'Healing for my mum' }).expect(200);

    const asCat = await http.get('/api/prayers?filter=mine').set(auth(ann)).expect(200);
    expect(asCat.body.map((p: { id: string }) => p.id)).toEqual(expect.arrayContaining([anon.body.id, open.body.id]));
    const wall = await http.get('/api/prayers?limit=100').set(auth(cat)).expect(200);
    const seenAnon = wall.body.find((p: { id: string }) => p.id === anon.body.id);
    expect(seenAnon).toMatchObject({ is_anonymous: true, author_id: null, author_name: null, is_mine: false, has_prayed: false });
    const mineAnon = (await http.get('/api/prayers').set(auth(ann)).expect(200)).body.find((p: { id: string }) => p.id === anon.body.id);
    expect(mineAnon).toMatchObject({ author_id: ann.id, author_name: 'ann', is_mine: true });
    // friends filter never includes anonymous prayers
    const friends = await http.get('/api/prayers?filter=friends').set(auth(ben)).expect(200);
    expect(friends.body.map((p: { id: string }) => p.id)).toEqual([open.body.id]);
    await http.get('/api/prayers?filter=bogus').set(auth(ben)).expect(400);

    expect((await http.post(`/api/prayers/${open.body.id}/pray`).set(auth(ben)).expect(200)).body).toEqual({ count: 1 });
    expect((await http.post(`/api/prayers/${open.body.id}/pray`).set(auth(ben)).expect(200)).body).toEqual({ count: 1 });
    expect((await http.post(`/api/prayers/${open.body.id}/pray`).set(auth(cat)).expect(200)).body).toEqual({ count: 2 });
    await http.post(`/api/prayers/${randomUUID()}/pray`).set(auth(cat)).expect(404);

    const sent: string[] = [];
    const notif = app.get(NotificationsService);
    const spy = jest.spyOn(notif, 'create').mockImplementation(async (userId: string, type: string) => {
      sent.push(`${type}:${userId}`);
      return null as never;
    });
    expect(await queuePrayerSummaries(prisma, notif)).toBeGreaterThanOrEqual(1);
    expect(sent).toContain(`prayer_summary:${ann.id}`);
    sent.length = 0;

    await http.post(`/api/prayers/${open.body.id}/answer`).set(auth(ben)).send({ testimony: 'Yes!' }).expect(403);
    await http.post(`/api/prayers/${open.body.id}/answer`).set(auth(ann)).send({ testimony: 'ok' }).expect(400);
    const ans = await http.post(`/api/prayers/${open.body.id}/answer`).set(auth(ann)).send({ testimony: 'She is home and well!' }).expect(200);
    expect(ans.body.post_id).toEqual(expect.any(String));
    expect(sent.sort()).toEqual([`prayer_answered:${ben.id}`, `prayer_answered:${cat.id}`].sort());
    const post = await prisma.community_posts.findUnique({ where: { id: ans.body.post_id } });
    expect(post).toMatchObject({ post_type: 'answered', prayer_id: open.body.id, author_id: ann.id });
    // idempotent
    expect((await http.post(`/api/prayers/${open.body.id}/answer`).set(auth(ann)).send({}).expect(200)).body).toEqual(ans.body);
    spy.mockRestore();

    const answered = await http.get('/api/prayers?filter=answered').set(auth(cat)).expect(200);
    expect(answered.body.find((p: { id: string }) => p.id === open.body.id)).toMatchObject({ has_prayed: true, testimony: 'She is home and well!' });

    await http.delete(`/api/prayers/${anon.body.id}`).set(auth(cat)).expect(403);
    await http.delete(`/api/prayers/${anon.body.id}`).set(auth(ann)).expect(200);
  });

  it('reports, blocks and the admin queue', async () => {
    const prayer = await http.post('/api/prayers').set(auth(cat)).send({ body: 'Spammy prayer here' }).expect(200);
    const body = { target_type: 'prayer', target_id: prayer.body.id, reason: 'spam', details: ' buy now ' };
    await http.post('/api/reports').set(auth(ann)).send(body).expect(200, { success: true });
    await http.post('/api/reports').set(auth(ann)).send(body).expect(200, { success: true }); // duplicate
    await http.post('/api/reports').set(auth(ben)).send(body).expect(200);
    await http.post('/api/reports').set(auth(ben)).send({ ...body, reason: 'nope' }).expect(400);

    await http.post('/api/blocks').set(auth(ann)).send({ user_id: ann.id }).expect(400);
    await http.post('/api/blocks').set(auth(ann)).send({ user_id: cat.id }).expect(200);
    await http.post('/api/blocks').set(auth(ann)).send({ user_id: cat.id }).expect(200);
    expect((await http.get('/api/blocks').set(auth(ann)).expect(200)).body).toEqual([cat.id]);
    const wall = await http.get('/api/prayers').set(auth(ann)).expect(200);
    expect(wall.body.some((p: { id: string }) => p.id === prayer.body.id)).toBe(false);
    await http.delete(`/api/blocks/${cat.id}`).set(auth(ann)).expect(200);
    expect((await http.get('/api/blocks').set(auth(ann)).expect(200)).body).toEqual([]);

    await http.get('/api/admin/reports').set(auth(ann)).expect(403);
    const queue = await http.get('/api/admin/reports').set(auth(boss)).expect(200);
    const item = queue.body.find((r: { target_id: string }) => r.target_id === prayer.body.id);
    expect(item).toMatchObject({ target_type: 'prayer', reason: 'spam', details: 'buy now', report_count: 2, preview: 'Spammy prayer here' });
    await http.post(`/api/admin/reports/${item.id}/resolve`).set(auth(boss)).send({ action: 'remove' }).expect(200);
    expect((await prisma.prayers.findUnique({ where: { id: prayer.body.id } })).hidden).toBe(true);
    expect(await prisma.reports.count({ where: { target_id: prayer.body.id, status: 'actioned' } })).toBe(2);
  });

  it('churches: search, guard, claims, recurring, events, follow', async () => {
    const created = await http.post('/api/churches').set(auth(ann))
      .send({ name: `${churchName} Grace`, city: 'Austin', verified: true, hidden: true, claimed_by: cat.id }).expect(200);
    expect(created.body).toMatchObject({ verified: false, hidden: false, claimed_by: ann.id, created_by: ann.id, city: 'Austin' });
    const id = created.body.id;
    const other = await http.post('/api/churches').set(auth(cat)).send({ name: `${churchName} Hope`, city: 'Dallas' }).expect(200);

    const found = await http.get(`/api/churches?q=${encodeURIComponent(churchName)}`).expect(200);
    expect(found.body.map((c: { name: string }) => c.name)).toEqual([`${churchName} Grace`, `${churchName} Hope`]);
    expect((await http.get('/api/churches?q=austin&limit=100').expect(200)).body.some((c: { id: string }) => c.id === id)).toBe(true);
    expect((await http.get(`/api/churches/${id}`).expect(200)).body).toMatchObject({ id });
    expect((await http.get(`/api/churches/${randomUUID()}`).expect(200)).body).toBeNull();

    await http.patch(`/api/churches/${id}`).set(auth(cat)).send({ about: 'hijack' }).expect(403);
    const upd = await http.patch(`/api/churches/${id}`).set(auth(ann)).send({ about: 'Welcome', verified: true }).expect(200);
    expect(upd.body).toMatchObject({ about: 'Welcome', verified: false });
    const my = await http.get('/api/my-churches').set(auth(ann)).expect(200);
    expect(my.body.map((c: { id: string }) => c.id)).toEqual([id]);

    // Claim cat's church; admin approves
    await http.post(`/api/churches/${other.body.id}/claim`).set(auth(ben)).send({ role_at_church: 'Pastor', note: 'I lead it' }).expect(200);
    await http.post(`/api/churches/${other.body.id}/claim`).set(auth(ben)).send({}).expect(200);
    await http.get('/api/admin/church-claims').set(auth(ben)).expect(403);
    const claims = await http.get('/api/admin/church-claims').set(auth(boss)).expect(200);
    const claim = claims.body.find((c: { church_id: string }) => c.church_id === other.body.id);
    expect(claim).toMatchObject({ user_id: ben.id, status: 'pending', churches: { name: `${churchName} Hope` } });
    await http.post(`/api/admin/church-claims/${claim.id}/decide`).set(auth(boss)).send({ approve: true }).expect(200);
    expect(await prisma.churches.findUnique({ where: { id: other.body.id } })).toMatchObject({ claimed_by: ben.id, verified: true });
    expect(await prisma.notifications.count({ where: { user_id: ben.id, type: 'church_claim' } })).toBe(1);
    await http.post(`/api/admin/church-claims/${randomUUID()}/decide`).set(auth(boss)).send({ approve: false }).expect(404);

    // Recurring
    await http.post(`/api/churches/${id}/recurring`).set(auth(cat)).send({ name: 'Service', frequency: 'weekly', weekday: 0, start_time: '10:00' }).expect(403);
    await http.post(`/api/churches/${id}/recurring`).set(auth(ann)).send({ name: 'Service', frequency: 'monthly', start_time: '10:00' }).expect(400);
    const rec = await http.post(`/api/churches/${id}/recurring`).set(auth(ann))
      .send({ name: 'Sunday Service', frequency: 'weekly', weekday: 0, start_time: '10:30', starts_on: '2026-11-01', is_service: true }).expect(200);
    expect(rec.body).toMatchObject({ start_time: '10:30:00', starts_on: '2026-11-01', ends_on: null, duration_minutes: 90 });
    const recUpd = await http.patch(`/api/church-recurring/${rec.body.id}`).set(auth(ann)).send({ frequency: 'monthly', day_of_month: 3 }).expect(200);
    expect(recUpd.body).toMatchObject({ frequency: 'monthly', day_of_month: 3, start_time: '10:30:00' });
    expect((await http.get(`/api/churches/${id}/recurring`).expect(200)).body).toHaveLength(1);
    await http.delete(`/api/church-recurring/${rec.body.id}`).set(auth(cat)).expect(403);
    await http.delete(`/api/church-recurring/${rec.body.id}`).set(auth(ann)).expect(200);

    // Events: host + owner only
    await http.post(`/api/churches/${other.body.id}/events`).set(auth(ann)).send({ event_id: eventId }).expect(403);
    await http.post(`/api/churches/${id}/events`).set(auth(ann)).send({ event_id: eventId }).expect(200);
    await http.post(`/api/churches/${id}/events`).set(auth(ann)).send({ event_id: eventId }).expect(200);
    expect((await http.get(`/api/churches/${id}/events`).expect(200)).body).toEqual([eventId]);

    // Follow
    expect((await http.get(`/api/churches/${id}/follow`).set(auth(cat)).expect(200)).body).toEqual({ following: false });
    await http.post(`/api/churches/${id}/follow`).set(auth(cat)).expect(200, { following: true });
    expect((await http.get(`/api/churches/${id}/follow`).set(auth(cat)).expect(200)).body).toEqual({ following: true });
    await http.delete(`/api/churches/${id}/follow`).set(auth(cat)).expect(200, { following: false });

    // Hidden churches disappear for everyone but owner and admins
    await prisma.churches.update({ where: { id }, data: { hidden: true } });
    expect((await http.get(`/api/churches/${id}`).set(auth(cat)).expect(200)).body).toBeNull();
    expect((await http.get(`/api/churches/${id}`).set(auth(ann)).expect(200)).body).toMatchObject({ id });
    expect((await http.get(`/api/churches/${id}`).set(auth(boss)).expect(200)).body).toMatchObject({ id });
  });

  it('serve: roles, sign-up rules, roster, check-in, complete, message, hours', async () => {
    const start = new Date(Date.now() + 86400_000);
    const end = new Date(start.getTime() + 2.5 * 3600_000);
    await http.post('/api/serve/roles').set(auth(cat)).send({ event_id: eventId, name: 'Ushers', shifts: [] }).expect(403);
    await http.post('/api/serve/roles').set(auth(ann)).send({ name: 'Ushers' }).expect(400);
    const role = await http.post('/api/serve/roles').set(auth(ann))
      .send({ event_id: eventId, name: 'Ushers', shifts: [{ starts_at: start.toISOString(), ends_at: end.toISOString(), spots: 1 }] }).expect(200);
    expect(role.body).toEqual({ id: expect.any(String) });

    const open = await http.get(`/api/serve/shifts?event_id=${eventId}`).expect(200);
    expect(open.body).toHaveLength(1);
    const shift = open.body[0];
    expect(shift).toMatchObject({ role_name: 'Ushers', spots: 1, taken: 0, event_name: `E2E Event ${stamp}`, my_signup_id: null });

    const s1 = await http.post(`/api/serve/shifts/${shift.shift_id}/signup`).set(auth(ben)).expect(200);
    expect(s1.body).toEqual({ id: expect.any(String), code: expect.stringMatching(/^[0-9A-F]{8}$/) });
    expect((await http.post(`/api/serve/shifts/${shift.shift_id}/signup`).set(auth(ben)).expect(200)).body).toEqual(s1.body);
    await http.post(`/api/serve/shifts/${shift.shift_id}/signup`).set(auth(cat)).expect(400, { error: 'This shift is full' });
    const mine = await http.get(`/api/serve/shifts?event_id=${eventId}`).set(auth(ben)).expect(200);
    expect(mine.body[0]).toMatchObject({ taken: 1, my_signup_id: s1.body.id, my_status: 'signed_up', my_code: s1.body.code });

    // cancel frees the spot; re-joining keeps the code
    await http.post(`/api/serve/signups/${s1.body.id}/cancel`).set(auth(cat)).expect(404);
    await http.post(`/api/serve/signups/${s1.body.id}/cancel`).set(auth(ben)).expect(200);
    const s2 = await http.post(`/api/serve/shifts/${shift.shift_id}/signup`).set(auth(ben)).expect(200);
    expect(s2.body).toEqual(s1.body);

    const managed = await http.get('/api/serve/my-shifts').set(auth(ann)).expect(200);
    expect(managed.body).toEqual([expect.objectContaining({ id: shift.shift_id, spots: 1, serve_roles: { name: 'Ushers', event_id: eventId, church_id: null } })]);
    await http.get(`/api/serve/shifts/${shift.shift_id}/roster`).set(auth(ben)).expect(403);
    const roster = await http.get(`/api/serve/shifts/${shift.shift_id}/roster`).set(auth(ann)).expect(200);
    expect(roster.body).toEqual([expect.objectContaining({ user_id: ben.id, status: 'signed_up', profiles: expect.objectContaining({ full_name: 'ben' }) })]);

    const sent: string[] = [];
    const spy = jest.spyOn(app.get(NotificationsService), 'create').mockImplementation(async (userId: string, type: string, title: string) => {
      sent.push(`${type}:${userId}:${title}`);
      return null as never;
    });
    await http.post(`/api/serve/shifts/${shift.shift_id}/message`).set(auth(ben)).send({ message: 'hi' }).expect(403);
    await http.post(`/api/serve/shifts/${shift.shift_id}/message`).set(auth(ann)).send({ message: ' ' }).expect(400);
    expect((await http.post(`/api/serve/shifts/${shift.shift_id}/message`).set(auth(ann)).send({ message: 'Arrive 15 min early' }).expect(200)).body).toEqual({ count: 1 });
    expect(sent).toEqual([`serve_message:${ben.id}:Message about your Ushers shift`]);
    spy.mockRestore();

    expect((await http.post('/api/serve/check-in').set(auth(cat)).send({ code: s1.body.code }).expect(200)).body)
      .toEqual({ valid: false, error: 'This volunteer pass is not for one of your shifts.' });
    expect((await http.post('/api/serve/check-in').set(auth(ann)).send({ code: ` ${s1.body.code.toLowerCase()} ` }).expect(200)).body)
      .toEqual({ valid: true, message: 'ben checked in · Ushers' });
    expect((await http.post('/api/serve/check-in').set(auth(boss)).send({ code: s1.body.code }).expect(200)).body)
      .toEqual({ valid: false, error: 'Already checked in.' });
    await http.post(`/api/serve/signups/${s1.body.id}/cancel`).set(auth(ben)).expect(400);

    await http.post(`/api/serve/shifts/${shift.shift_id}/complete`).set(auth(ben)).expect(403);
    expect((await http.post(`/api/serve/shifts/${shift.shift_id}/complete`).set(auth(ann)).expect(200)).body).toEqual({ count: 1 });
    expect((await http.get('/api/serve/hours').set(auth(ben)).expect(200)).body).toEqual({ hours: 2.5 });
    expect((await http.get('/api/serve/hours').set(auth(cat)).expect(200)).body).toEqual({ hours: 0 });
  });

  it('DELETE /account: blocked with sold upcoming tickets, otherwise removes the user and keeps tickets', async () => {
    const ev = await prisma.events.create({ data: { host_id: ann.id, name: 'Paid', status: 'published', start_date: in2days } });
    const tt = await prisma.ticket_types.create({ data: { event_id: ev.id } as never });
    const t = await prisma.tickets.create({
      data: {
        event_id: ev.id, ticket_type_id: (tt as { id: string }).id, user_id: gone.id, status: 'confirmed', unit_price_cents: 1000,
        total_charged_cents: 1000, platform_fee_cents: 0, stripe_fee_cents: 0, host_receives_cents: 1000,
      },
    });
    await http.delete('/api/account').set(auth(ann)).expect(400);

    await prisma.prayers.create({ data: { author_id: gone.id, body: 'Bye prayer' } });
    await prisma.refresh_tokens.create({ data: { user_id: gone.id, token_hash: `e2e-${stamp}`, expires_at: in2days } });
    await http.delete('/api/account').set(auth(gone)).expect(200, { success: true });
    expect(await prisma.users.findUnique({ where: { id: gone.id } })).toBeNull();
    expect(await prisma.prayers.count({ where: { author_id: gone.id } })).toBe(0);
    expect(await prisma.refresh_tokens.count({ where: { user_id: gone.id } })).toBe(0);
    expect((await prisma.tickets.findUnique({ where: { id: t.id } })).user_id).toBeNull();

    // Host with sales history: events kept, profile scrubbed, email renamed, sessions revoked
    const past = await prisma.events.create({ data: { host_id: host.id, name: 'Past', status: 'published', start_date: new Date(Date.now() - 86400_000) } });
    const future = await prisma.events.create({ data: { host_id: host.id, name: 'Future', status: 'draft', start_date: in2days } });
    const tt2 = await prisma.ticket_types.create({ data: { event_id: past.id } as never });
    await prisma.tickets.create({
      data: {
        event_id: past.id, ticket_type_id: (tt2 as { id: string }).id, user_id: ben.id, status: 'refunded', unit_price_cents: 1000,
        total_charged_cents: 1000, platform_fee_cents: 0, stripe_fee_cents: 0, host_receives_cents: 1000,
      },
    });
    await prisma.refresh_tokens.create({ data: { user_id: host.id, token_hash: `e2e-host-${stamp}`, expires_at: in2days } });
    await http.delete('/api/account').set(auth(host)).expect(200);
    const deleted = `deleted+${host.id}@deleted.christlinksocial.com`;
    expect(await prisma.users.findUnique({ where: { id: host.id } })).toMatchObject({ email: deleted });
    expect(await prisma.profiles.findUnique({ where: { id: host.id } })).toMatchObject({ email: deleted, full_name: 'Deleted host', bio: null });
    expect((await prisma.events.findUnique({ where: { id: future.id } })).status).toBe('cancelled');
    expect((await prisma.events.findUnique({ where: { id: past.id } })).status).toBe('published');
    expect(await prisma.refresh_tokens.count({ where: { user_id: host.id } })).toBe(0);
  });
});
