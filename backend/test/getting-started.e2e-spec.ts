import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { configureApi } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Getting started (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  const stamp = Date.now();
  const mk = (name: string) => ({ id: randomUUID(), email: `setup-${name}-${stamp}@example.com`, name });
  const fresh = mk('fresh');
  const veteran = mk('veteran');
  const complete = mk('complete');
  const tokens: Record<string, string> = {};
  const auth = (u: { id: string }) => ({ Authorization: `Bearer ${tokens[u.id]}` });
  let churchId = '';
  let eventId = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApi(moduleRef.createNestApplication<NestExpressApplication>({ rawBody: true }));
    await app.init();
    prisma = app.get(PrismaService);
    const jwt = app.get(JwtService);
    const old = new Date(Date.now() - 90 * 86_400_000);
    for (const u of [fresh, veteran, complete]) {
      await prisma.users.create({ data: { id: u.id, email: u.email } });
      await prisma.profiles.create({ data: { id: u.id, email: u.email, full_name: u.name, ...(u === fresh ? {} : { created_at: old }) } });
      tokens[u.id] = jwt.sign({ sub: u.id, email: u.email });
    }
    churchId = (await prisma.churches.create({ data: { name: `Setup Church ${stamp}` } })).id;
    eventId = (await prisma.events.create({ data: { host_id: veteran.id, name: 'Setup Night', status: 'published', event_type: 'Worship', start_date: new Date(Date.now() + 86_400_000) } })).id;
    // An account that had everything done before the checklist existed
    await prisma.profiles.update({
      where: { id: complete.id },
      data: { avatar_url: 'https://x/a.webp', banner_url: 'https://x/b.webp', bio: 'Hi', hobbies: 'Music' },
    });
    await prisma.user_settings.create({ data: { user_id: complete.id, home_church_id: churchId } });
    await prisma.prayers.create({ data: { author_id: complete.id, body: 'Pray for my week' } });
    await prisma.rsvps.create({ data: { event_id: eventId, user_id: complete.id, status: 'confirmed' } });
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await prisma.users.deleteMany({ where: { id: { in: [fresh.id, veteran.id, complete.id] } } });
    await prisma.churches.deleteMany({ where: { id: churchId } });
    await app.close();
  });

  it('needs sign-in', async () => {
    await http.get('/api/getting-started').expect(401);
  });

  it('a new account gets the welcome tour and an empty checklist', async () => {
    const r = await http.get('/api/getting-started').set(auth(fresh)).expect(200);
    expect(r.body).toMatchObject({ done: 0, total: 7, welcome: true, show: true, celebrate: false, completed_at: null });
    expect(r.body.steps.map((s: { id: string }) => s.id)).toEqual(['photo', 'cover', 'bio', 'interests', 'church', 'post', 'event']);

    const w = await http.post('/api/getting-started/welcomed').set(auth(fresh)).expect(200);
    expect(w.body).toMatchObject({ welcome: false, show: true });
  });

  it('steps tick as the person does them, and finishing celebrates once with a notification', async () => {
    await http.post('/api/getting-started/celebrate').set(auth(fresh)).expect(200, { celebrate: false });

    await prisma.profiles.update({ where: { id: fresh.id }, data: { avatar_url: 'https://x/a.webp', bio: '  ' } });
    let r = await http.get('/api/getting-started').set(auth(fresh)).expect(200);
    expect(r.body.steps.filter((s: { done: boolean }) => s.done).map((s: { id: string }) => s.id)).toEqual(['photo']);

    await prisma.profiles.update({ where: { id: fresh.id }, data: { banner_url: 'https://x/b.webp', bio: 'Worship leader', connect_tags: ['bible-study'] } });
    await http.patch('/api/settings').set(auth(fresh)).send({ home_church_id: churchId }).expect(200);
    await prisma.community_posts.create({ data: { author_id: fresh.id, body: 'Hello all' } });
    r = await http.get('/api/getting-started').set(auth(fresh)).expect(200);
    expect(r.body).toMatchObject({ done: 6, celebrate: false, show: true });

    await http.post('/api/rsvp').set(auth(fresh)).send({ eventId }).expect(200);
    r = await http.get('/api/getting-started').set(auth(fresh)).expect(200);
    expect(r.body).toMatchObject({ done: 7, celebrate: true, show: true });

    await http.post('/api/getting-started/celebrate').set(auth(fresh)).expect(200, { celebrate: true });
    await http.post('/api/getting-started/celebrate').set(auth(fresh)).expect(200, { celebrate: false });
    r = await http.get('/api/getting-started').set(auth(fresh)).expect(200);
    expect(r.body).toMatchObject({ done: 7, celebrate: false, show: false });
    expect(r.body.completed_at).toEqual(expect.any(String));

    const notes = await prisma.notifications.findMany({ where: { user_id: fresh.id, type: 'setup_complete' } });
    expect(notes).toHaveLength(1);
    expect(notes[0].title).toBe('You’re all set up');
  });

  it('older accounts get the checklist but not the welcome tour, and can hide it', async () => {
    const r = await http.get('/api/getting-started').set(auth(veteran)).expect(200);
    expect(r.body).toMatchObject({ welcome: false, show: true, done: 0 });
    const h = await http.post('/api/getting-started/hide').set(auth(veteran)).expect(200);
    expect(h.body).toMatchObject({ show: false });
  });

  it('an account that was already complete is marked done quietly (no thank-you)', async () => {
    const r = await http.get('/api/getting-started').set(auth(complete)).expect(200);
    expect(r.body).toMatchObject({ done: 7, show: false, celebrate: false, welcome: false });
    await http.post('/api/getting-started/celebrate').set(auth(complete)).expect(200, { celebrate: false });
    expect(await prisma.notifications.count({ where: { user_id: complete.id, type: 'setup_complete' } })).toBe(0);
  });
});
