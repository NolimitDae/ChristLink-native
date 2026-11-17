import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerGuard } from '@nestjs/throttler';
import { randomUUID } from 'crypto';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { configureApi } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { StorageService } from '../src/modules/storage/storage.service';
import * as linkPreview from '../src/modules/events/link-preview';
import { FlyerReaderService } from '../src/modules/events/flyer-reader';

// The page fetch is the only network call; everything else (parsing, storage hand-off, rules) runs for real
jest.mock('../src/modules/events/link-preview', () => ({
  ...jest.requireActual('../src/modules/events/link-preview'),
  fetchListingHtml: jest.fn(),
  fetchImageDataUrl: jest.fn(),
}));
const fetchListingHtml = linkPreview.fetchListingHtml as jest.Mock;
const fetchImageDataUrl = linkPreview.fetchImageDataUrl as jest.Mock;

describe('Reposts: sharing an event from another platform (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  const stamp = Date.now();
  const mk = (name: string) => ({ id: randomUUID(), email: `repost-${name}-${stamp}@example.com`, name });
  const sharer = mk('sharer');
  const fan = mk('fan'); // follows sharer
  const other = mk('other');
  const users = [sharer, fan, other];
  const tokens: Record<string, string> = {};
  const auth = (u: { id: string }) => ({ Authorization: `Bearer ${tokens[u.id]}` });
  const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();
  const listing = `https://www.eventbrite.com/e/city-worship-${stamp}`;
  const valid = () => ({
    name: `City Worship Night ${stamp}`,
    organizer_name: 'Grace Chapel',
    start_date: inDays(10),
    end_date: inDays(10.1),
    format: 'in_person',
    venue_name: 'Grace Chapel',
    city: 'Dover',
    state: 'DE',
    description: 'An evening of <b>worship</b>.',
    source_url: `${listing}?utm_source=ig`,
    ticket_url: `${listing}/tickets`,
  });
  let repostId: string;

  beforeAll(async () => {
    jest.spyOn(ThrottlerGuard.prototype, 'canActivate').mockResolvedValue(true);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApi(moduleRef.createNestApplication<NestExpressApplication>({ rawBody: true }));
    await app.init();
    prisma = app.get(PrismaService);
    const jwt = app.get(JwtService);
    for (const u of users) {
      await prisma.users.create({ data: { id: u.id, email: u.email } });
      await prisma.profiles.create({ data: { id: u.id, email: u.email, full_name: u.name, role: 'attendee' } });
      tokens[u.id] = jwt.sign({ sub: u.id, email: u.email });
    }
    await prisma.user_follows.create({ data: { follower_id: fan.id, following_id: sharer.id } });
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await prisma.events.deleteMany({ where: { host_id: { in: users.map((u) => u.id) } } });
    await prisma.users.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
    await app.close();
  });

  it('needs sign-in and the basics', async () => {
    await http.post('/api/reposts').send(valid()).expect(401);
    const bad = async (patch: Record<string, unknown>, error: string) => {
      const res = await http.post('/api/reposts').set(auth(sharer)).send({ ...valid(), ...patch }).expect(400);
      expect(res.body.error).toBe(error);
    };
    await bad({ name: 'ab' }, 'Add the event’s name (at least 3 characters).');
    await bad({ organizer_name: '' }, 'Add who is hosting the event.');
    await bad({ start_date: undefined }, 'Add when the event starts.');
    await bad({ start_date: inDays(-3) }, 'That date has already passed.');
    await bad({ end_date: inDays(9) }, 'The end must be after the start.');
    await bad({ city: '' }, 'Add the city where it’s happening.');
    await bad({ source_url: 'http://localhost:4000/admin' }, 'That link can’t be used.');
    await bad({ ticket_url: 'javascript:alert(1)' }, 'That doesn’t look like a link.');
    await bad({ ticket_url: 'ftp://example.com/tickets' }, 'Only web links (https) can be used.');
  });

  it('creates a published, free repost with its forum on, and tells followers', async () => {
    const res = await http.post('/api/reposts').set(auth(sharer)).send(valid()).expect(200);
    repostId = res.body.event.id;
    expect(res.body.event).toMatchObject({
      is_repost: true, is_paid: false, forum_enabled: true, status: 'published', host_id: sharer.id,
      organizer_name: 'Grace Chapel', description: 'An evening of worship.', source_url: `${listing}?utm_source=ig`, ticket_url: `${listing}/tickets`,
    });
    // Sharing doesn't make someone a host
    expect((await prisma.profiles.findUnique({ where: { id: sharer.id } }))?.role).toBe('attendee');

    const page = await http.get(`/api/events/${repostId}`).expect(200);
    expect(page.body).toMatchObject({ is_repost: true, organizer_name: 'Grace Chapel', host_name: 'sharer', ticket_url: `${listing}/tickets` });
    const list = await http.get(`/api/events?q=${encodeURIComponent(`City Worship Night ${stamp}`)}`).expect(200);
    expect(list.body.events.map((e: { id: string }) => e.id)).toContain(repostId);

    let note = null;
    for (let i = 0; i < 40 && !note; i++) {
      note = await prisma.notifications.findFirst({ where: { user_id: fan.id, type: 'new_event' } });
      if (!note) await new Promise((r) => setTimeout(r, 50));
    }
    expect(note).toMatchObject({ title: 'sharer shared an event', body: `City Worship Night ${stamp}` });
  });

  it('"I’m going" is an RSVP and the forum works for people going', async () => {
    await http.post('/api/rsvp').set(auth(other)).send({ eventId: repostId }).expect(200);
    const page = await http.get(`/api/events/${repostId}`).expect(200);
    expect(page.body.confirmed_rsvps).toBe(1);
    await http.post(`/api/events/${repostId}/forum`).set(auth(other)).send({ content: 'Anyone carpooling?' }).expect(200);
    const forum = await http.get(`/api/events/${repostId}/forum`).set(auth(other)).expect(200);
    expect(JSON.stringify(forum.body)).toContain('Anyone carpooling?');
  });

  it('points a second share of the same listing at the existing page', async () => {
    const res = await http.post('/api/reposts').set(auth(other)).send({ ...valid(), source_url: `${listing}/#tickets` }).expect(409);
    expect(res.body).toEqual({ error: 'Someone has already shared this event.', existingId: repostId });
  });

  it('never sells tickets for a repost', async () => {
    const res = await http.post('/api/ticket-types').set(auth(sharer)).send({ event_id: repostId, name: 'GA', price_cents: 1500 }).expect(400);
    expect(res.body.error).toBe('Tickets can’t be sold for a shared event. Link to the original instead.');
  });

  it('only the sharer can edit; edits are checked like new reposts', async () => {
    await http.patch(`/api/reposts/${repostId}`).set(auth(other)).send({ name: 'Hijacked' }).expect(403);
    await http.patch(`/api/reposts/${repostId}`).set(auth(sharer)).send({ ticket_url: 'http://10.0.0.1/' }).expect(400);
    const res = await http.patch(`/api/reposts/${repostId}`).set(auth(sharer)).send({ organizer_name: 'Grace Chapel Worship', ticket_url: '' }).expect(200);
    expect(res.body.event).toMatchObject({ organizer_name: 'Grace Chapel Worship', ticket_url: null, name: `City Worship Night ${stamp}` });
    // A normal event can't be edited through the repost route
    const normal = await prisma.events.create({ data: { host_id: sharer.id, name: 'Normal', status: 'published' } });
    await http.patch(`/api/reposts/${normal.id}`).set(auth(sharer)).send({ name: 'Nope nope' }).expect(404);
  });

  it('a flyer becomes the picture; details are read only when flyer reading is set up', async () => {
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const put = jest.spyOn(app.get(StorageService), 'putDataUrl').mockResolvedValue('https://media.example.com/events/x/flyer.webp');
    const reader = app.get(FlyerReaderService);
    const read = jest.spyOn(reader, 'read');
    await http.post('/api/reposts/flyer').send({ dataUrl: png }).expect(401);
    await http.post('/api/reposts/flyer').set(auth(other)).send({ dataUrl: 'nope' }).expect(400);

    // No key configured: picture only, nothing sent anywhere
    const off = await http.post('/api/reposts/flyer').set(auth(other)).send({ dataUrl: png }).expect(200);
    expect(off.body).toEqual({ preview: { cover_url: 'https://media.example.com/events/x/flyer.webp' }, read: false });
    expect(read).not.toHaveBeenCalled();
    expect(put).toHaveBeenCalledWith('events', other.id, png);

    // Set up: the reader's fields come back with the picture
    jest.spyOn(reader, 'enabled', 'get').mockReturnValue(true);
    read.mockResolvedValue({ name: 'Winter Retreat', city: 'Lewes', start_date: '2026-12-12T09:00' });
    const on = await http.post('/api/reposts/flyer').set(auth(other)).send({ dataUrl: png }).expect(200);
    expect(on.body).toEqual({ preview: { name: 'Winter Retreat', city: 'Lewes', start_date: '2026-12-12T09:00', cover_url: 'https://media.example.com/events/x/flyer.webp' }, read: true });
    // A flyer that can't be read still becomes the picture
    read.mockResolvedValue(null);
    const unread = await http.post('/api/reposts/flyer').set(auth(other)).send({ dataUrl: png }).expect(200);
    expect(unread.body).toEqual({ preview: { cover_url: 'https://media.example.com/events/x/flyer.webp' }, read: false });
    jest.restoreAllMocks();
    jest.spyOn(ThrottlerGuard.prototype, 'canActivate').mockResolvedValue(true);
  });

  it('taking a repost down deletes it (it is not shown as a cancelled event)', async () => {
    const res = await http.post('/api/reposts').set(auth(other)).send({ ...valid(), name: `Short lived ${stamp}`, source_url: `${listing}-gone` }).expect(200);
    await http.delete(`/api/events/${res.body.event.id}`).set(auth(sharer)).expect(404);
    await http.delete(`/api/events/${res.body.event.id}`).set(auth(other)).expect(200, { success: true, action: 'deleted' });
    await http.get(`/api/events/${res.body.event.id}`).expect(404);
  });

  it('caps how many events a member can share in a day', async () => {
    for (let i = 0; i < 4; i++) {
      await http.post('/api/reposts').set(auth(sharer)).send({ ...valid(), name: `Another ${i} ${stamp}`, source_url: `${listing}-${i}` }).expect(200);
    }
    const res = await http.post('/api/reposts').set(auth(sharer)).send({ ...valid(), name: `One too many ${stamp}`, source_url: `${listing}-x` }).expect(429);
    expect(res.body.error).toBe('You can share up to 5 events a day. Try again tomorrow.');
  });

  it('fills the form from a listing link and copies its picture to our storage', async () => {
    const put = jest.spyOn(app.get(StorageService), 'putDataUrl').mockResolvedValue('https://media.example.com/events/x/flyer.webp');
    fetchListingHtml.mockResolvedValue({
      finalUrl: new URL('https://church.org/events/retreat'),
      html: `<html><head><script type="application/ld+json">${JSON.stringify({
        '@type': 'Event', name: 'Winter Retreat', startDate: '2026-12-12T09:00:00-05:00',
        location: { '@type': 'Place', name: 'Camp Hope', address: { addressLocality: 'Lewes', addressRegion: 'DE' } },
        organizer: { name: 'Hope Church' }, image: 'https://church.org/retreat.jpg',
      })}</script></head></html>`,
    });
    fetchImageDataUrl.mockResolvedValue('data:image/jpeg;base64,AAAA');
    await http.post('/api/reposts/preview').send({ url: 'https://church.org/events/retreat' }).expect(401);
    const res = await http.post('/api/reposts/preview').set(auth(other)).send({ url: 'church.org/events/retreat' }).expect(200);
    expect(res.body.preview).toEqual({
      name: 'Winter Retreat', start_date: '2026-12-12T09:00:00-05:00', format: 'in_person', venue_name: 'Camp Hope', city: 'Lewes', state: 'DE',
      organizer_name: 'Hope Church', source_url: 'https://church.org/events/retreat', ticket_url: 'https://church.org/events/retreat',
      cover_url: 'https://media.example.com/events/x/flyer.webp',
    });
    expect(fetchImageDataUrl).toHaveBeenCalledWith('https://church.org/retreat.jpg');
    expect(put).toHaveBeenCalledWith('events', other.id, 'data:image/jpeg;base64,AAAA');

    // A page that can't be read gives a message fit to show, and private addresses are refused before any fetch
    fetchListingHtml.mockRejectedValue(new Error('status 403'));
    const blocked = await http.post('/api/reposts/preview').set(auth(other)).send({ url: 'https://facebook.com/events/1' }).expect(422);
    expect(blocked.body).toEqual({ error: expect.stringContaining('couldn’t read that page'), source_url: 'https://facebook.com/events/1' });
    fetchListingHtml.mockClear();
    await http.post('/api/reposts/preview').set(auth(other)).send({ url: 'http://169.254.169.254/latest' }).expect(400);
    expect(fetchListingHtml).not.toHaveBeenCalled();
  });
});
