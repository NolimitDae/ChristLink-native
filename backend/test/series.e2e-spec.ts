import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { configureApi } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { fromWallTime, wallTime } from '../src/modules/events/recurrence';
import { topUpAllSeries } from '../src/modules/events/series';

const NY = 'America/New_York';
const localHM = (iso: string) => {
  const w = wallTime(new Date(iso), NY);
  return `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][w.weekday]} ${String(w.h).padStart(2, '0')}:${String(w.min).padStart(2, '0')}`;
};

describe('Repeating events (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  const stamp = Date.now();
  const host = { id: randomUUID(), email: `series-host-${stamp}@example.com` };
  const guest = { id: randomUUID(), email: `series-guest-${stamp}@example.com` };
  const tokens: Record<string, string> = {};
  const as = (u: { id: string }) => ({ Authorization: `Bearer ${tokens[u.id]}` });
  const name = `Tuesday Night Prayer ${stamp}`;
  // Next Tuesday at least a week out, 7 pm New York
  const now = new Date();
  const w = wallTime(now, NY);
  const daysToTue = ((2 - w.weekday + 7) % 7) + 7;
  const firstStart = fromWallTime(w.y, w.m, w.d + daysToTue, 19, 0, NY);
  const firstEnd = new Date(firstStart.getTime() + 90 * 60_000);
  let firstId = '';
  let seriesId = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApi(moduleRef.createNestApplication<NestExpressApplication>({ rawBody: true }));
    await app.init();
    prisma = app.get(PrismaService);
    const jwt = app.get(JwtService);
    for (const u of [host, guest]) {
      await prisma.users.create({ data: { id: u.id, email: u.email } });
      await prisma.profiles.create({ data: { id: u.id, email: u.email, full_name: u === host ? 'Host' : 'Guest' } });
      tokens[u.id] = jwt.sign({ sub: u.id, email: u.email });
    }
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await prisma.events.deleteMany({ where: { host_id: host.id } });
    await prisma.users.deleteMany({ where: { id: { in: [host.id, guest.id] } } });
    await app.close();
  });

  const base = () => ({
    name,
    description: 'Prayer and worship every week',
    event_type: 'Prayer',
    format: 'online',
    online_url: 'https://meet.example.com/prayer',
    start_date: firstStart.toISOString(),
    end_date: firstEnd.toISOString(),
  });

  it('only free events can repeat, and the rule is checked', async () => {
    await http.post('/api/events').set(as(host)).send({ ...base(), is_paid: true, repeat: { rule: 'weekly', timezone: NY } }).expect(400);
    await http.post('/api/events').set(as(host)).send({ ...base(), repeat: { rule: 'daily', timezone: NY } }).expect(400);
    const far = new Date(firstStart.getTime() + 400 * 86_400_000).toISOString().slice(0, 10);
    const r = await http.post('/api/events').set(as(host)).send({ ...base(), repeat: { rule: 'weekly', timezone: NY, until: far } }).expect(400);
    expect(r.body.message ?? r.body.error).toMatch(/up to a year/);
  });

  it('creates the first date as a draft with its series; nothing else until it is published', async () => {
    const r = await http.post('/api/events').set(as(host)).send({ ...base(), repeat: { rule: 'weekly', timezone: NY } }).expect(200);
    firstId = r.body.id;
    seriesId = r.body.series_id;
    expect(seriesId).toEqual(expect.any(String));
    expect(r.body.series_index).toBe(0);
    expect(await prisma.events.count({ where: { series_id: seriesId } })).toBe(1);
    const g = await http.get(`/api/events/${firstId}`).set(as(host)).expect(200);
    expect(g.body).toMatchObject({ repeat_rule: 'weekly', series: { rule: 'weekly', timezone: NY, ended: false } });
    expect(g.body.series.dates).toHaveLength(1);
  });

  it('can change or drop the rule while it is a draft', async () => {
    await http.patch(`/api/events/${firstId}`).set(as(host)).send({ repeat: { rule: 'monthly', timezone: NY } }).expect(200);
    expect((await prisma.event_series.findUnique({ where: { id: seriesId } }))?.rule).toBe('monthly');
    await http.patch(`/api/events/${firstId}`).set(as(host)).send({ repeat: { rule: 'weekly', timezone: NY } }).expect(200);
    expect((await prisma.event_series.findUnique({ where: { id: seriesId } }))?.rule).toBe('weekly');
  });

  it('publishing adds the next three months of dates at the same local time; lists show it once', async () => {
    await http.patch(`/api/events/${firstId}/publish`).set(as(host)).expect(200);
    const dates = await prisma.events.findMany({ where: { series_id: seriesId }, orderBy: { series_index: 'asc' } });
    expect(dates.length).toBeGreaterThanOrEqual(12);
    expect(dates.length).toBeLessThanOrEqual(14);
    expect(dates.every((d) => d.status === 'published' && d.is_paid === false && d.name === name)).toBe(true);
    expect(new Set(dates.map((d) => localHM(d.start_date!.toISOString())))).toEqual(new Set(['Tue 19:00']));
    expect(dates.every((d) => d.end_date!.getTime() - d.start_date!.getTime() === 90 * 60_000)).toBe(true);

    const list = await http.get('/api/events').query({ q: name }).expect(200);
    expect(list.body.events.map((e: { id: string }) => e.id)).toEqual([firstId]);
    expect(list.body.events[0]).toMatchObject({ series_id: seriesId, repeat_rule: 'weekly' });
    // The host's own list (host_id) shows every date
    const mine = await http.get('/api/events').query({ host_id: host.id }).expect(200);
    expect(mine.body.events.length).toBe(dates.length);
  });

  it('each date takes its own RSVPs; the page lists the next dates; no tickets on a series', async () => {
    const third = await prisma.events.findFirstOrThrow({ where: { series_id: seriesId, series_index: 2 } });
    await http.post('/api/rsvp').set(as(guest)).send({ eventId: third.id }).expect(200);
    const g = await http.get(`/api/events/${third.id}`).expect(200);
    expect(g.body.confirmed_rsvps).toBe(1);
    expect(g.body.series.dates.length).toBe(12);
    expect(g.body.series.dates[0].id).toBe(firstId);
    const first = await http.get(`/api/events/${firstId}`).expect(200);
    expect(first.body.confirmed_rsvps).toBe(0);
    await http.post('/api/ticket-types').set(as(host)).send({ event_id: third.id, name: 'GA', price_cents: 1000 }).expect(400);
  });

  it('"all upcoming dates" applies a new description and time to every later date', async () => {
    const second = await prisma.events.findFirstOrThrow({ where: { series_id: seriesId, series_index: 1 } });
    const newStart = new Date(second.start_date!.getTime() + 60 * 60_000); // 8 pm
    await http
      .patch(`/api/events/${second.id}`)
      .set(as(host))
      .send({ description: 'Now at 8', start_date: newStart.toISOString(), end_date: new Date(newStart.getTime() + 90 * 60_000).toISOString(), apply_to: 'series' })
      .expect(200);
    const dates = await prisma.events.findMany({ where: { series_id: seriesId }, orderBy: { series_index: 'asc' } });
    expect(dates[0].description).toBe('Prayer and worship every week'); // earlier date untouched
    expect(localHM(dates[0].start_date!.toISOString())).toBe('Tue 19:00');
    for (const d of dates.slice(1)) {
      expect(d.description).toBe('Now at 8');
      expect(localHM(d.start_date!.toISOString())).toBe('Tue 20:00');
    }
    // Dates added later follow the new time
    const s = await prisma.event_series.findUniqueOrThrow({ where: { id: seriesId } });
    expect(localHM(s.anchor_start.toISOString())).toBe('Tue 20:00');
  });

  it('a single date can be cancelled without being refilled; the job keeps adding dates', async () => {
    const fourth = await prisma.events.findFirstOrThrow({ where: { series_id: seriesId, series_index: 3 } });
    await http.delete(`/api/events/${fourth.id}`).set(as(host)).expect(200, { success: true, action: 'cancelled' });
    const before = await prisma.events.count({ where: { series_id: seriesId } });
    await topUpAllSeries(prisma, undefined, new Date(Date.now() + 60 * 86_400_000));
    const after = await prisma.events.findMany({ where: { series_id: seriesId }, orderBy: { series_index: 'asc' } });
    expect(after.length).toBeGreaterThan(before);
    expect(after.find((d) => d.series_index === 3)?.status).toBe('cancelled');
    expect(new Set(after.map((d) => d.series_index)).size).toBe(after.length);
    // Running twice adds nothing more
    const again = await topUpAllSeries(prisma, undefined, new Date(Date.now() + 60 * 86_400_000));
    expect(await prisma.events.count({ where: { series_id: seriesId } })).toBe(after.length);
    expect(again.added).toBe(0);
  });

  it('the rule can’t change once live; "this and later dates" ends the series', async () => {
    await http.patch(`/api/events/${firstId}`).set(as(host)).send({ repeat: { rule: 'monthly', timezone: NY } }).expect(400);
    const sixth = await prisma.events.findFirstOrThrow({ where: { series_id: seriesId, series_index: 5 } });
    const r = await http.delete(`/api/events/${sixth.id}?scope=following`).set(as(host)).expect(200);
    expect(r.body).toMatchObject({ success: true, action: 'series_ended' });
    const dates = await prisma.events.findMany({ where: { series_id: seriesId }, orderBy: { series_index: 'asc' } });
    expect(dates.filter((d) => (d.series_index ?? 0) >= 5).every((d) => d.status === 'cancelled')).toBe(true);
    expect(dates.find((d) => d.series_index === 4)?.status).toBe('published');
    const added = await topUpAllSeries(prisma, undefined, new Date(Date.now() + 200 * 86_400_000));
    expect(await prisma.events.count({ where: { series_id: seriesId } })).toBe(dates.length);
    expect(added.series).toBeGreaterThanOrEqual(0);
    const g = await http.get(`/api/events/${firstId}`).expect(200);
    expect(g.body.series.ended).toBe(true);
    expect(g.body.repeat_rule).toBeNull();
  });

  it('another person can’t end someone else’s series', async () => {
    await http.delete(`/api/events/${firstId}?scope=following`).set(as(guest)).expect(404);
  });
});
