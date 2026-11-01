import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerGuard } from '@nestjs/throttler';
import { randomUUID } from 'crypto';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { configureApi } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { PaymentsService } from '../src/modules/payments/payments.service';

describe('Event waitlist (e2e)', () => {
  let app: NestExpressApplication;
  let http: ReturnType<typeof request>;
  let prisma: PrismaService;
  const users: Record<string, { id: string; auth: string }> = {};
  const as = (key: string) => ({ Authorization: users[key].auth });
  const soon = () => new Date(Date.now() + 5 * 864e5);

  async function until<T>(fn: () => Promise<T | null | undefined>): Promise<T | null> {
    for (let i = 0; i < 60; i++) {
      const v = await fn();
      if (v) return v;
      await new Promise((r) => setTimeout(r, 50));
    }
    return null;
  }

  beforeAll(async () => {
    jest.spyOn(ThrottlerGuard.prototype, 'canActivate').mockResolvedValue(true);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApi(moduleRef.createNestApplication<NestExpressApplication>({ rawBody: true }));
    await app.init();
    prisma = app.get(PrismaService);
    http = request(app.getHttpServer());
    for (const key of ['host', 'a', 'b', 'c']) {
      const id = randomUUID();
      const email = `waitlist-e2e+${key}-${id}@example.com`;
      await prisma.users.create({ data: { id, email } });
      await prisma.profiles.create({ data: { id, email, full_name: `User ${key}` } });
      users[key] = { id, auth: `Bearer ${await app.get(JwtService).signAsync({ sub: id, email })}` };
    }
  });

  afterAll(async () => {
    await prisma.events.deleteMany({ where: { host_id: users.host.id } });
    await prisma.users.deleteMany({ where: { email: { startsWith: 'waitlist-e2e+' } } });
    await app.close();
  });

  it('free event: join when full, keep your place, auto-RSVP when a spot opens', async () => {
    const ev = await prisma.events.create({
      data: { host_id: users.host.id, name: 'Full Worship Night', status: 'published', start_date: soon(), max_capacity: 1 },
    });
    await http.post(`/api/events/${ev.id}/waitlist`).set(as('b')).expect(400, { error: 'Spots are open — RSVP or get tickets now.' });
    await http.post('/api/rsvp').set(as('a')).send({ eventId: ev.id }).expect(200);
    await http.post(`/api/events/${ev.id}/waitlist`).set(as('a')).expect(400, { error: 'You’re already going to this event.' });

    expect((await http.post(`/api/events/${ev.id}/waitlist`).set(as('b')).expect(200)).body).toEqual({ joined: true, status: 'waiting', position: 1, waiting: 1 });
    expect((await http.post(`/api/events/${ev.id}/waitlist`).set(as('c')).expect(200)).body).toMatchObject({ position: 2, waiting: 2 });
    await http.post(`/api/events/${ev.id}/waitlist`).send().expect(401);

    // a cancels → b is RSVP'd automatically and told
    await http.delete(`/api/rsvp/${ev.id}`).set(as('a')).expect(200);
    const rsvp = await until(() => prisma.rsvps.findFirst({ where: { event_id: ev.id, user_id: users.b.id, status: 'confirmed' } }));
    expect(rsvp).not.toBeNull();
    const told = await until(() => prisma.notifications.findFirst({ where: { user_id: users.b.id, type: 'waitlist_promoted' } }));
    expect(told).toMatchObject({ title: 'You’re in — Full Worship Night', data: { eventId: ev.id } });
    expect((await http.get(`/api/events/${ev.id}/waitlist`).set(as('b')).expect(200)).body).toMatchObject({ joined: false, position: null });
    expect((await http.get(`/api/events/${ev.id}/waitlist`).set(as('c')).expect(200)).body).toMatchObject({ joined: true, position: 1, waiting: 1 });

    // c leaves; raising capacity promotes nobody else
    await http.delete(`/api/events/${ev.id}/waitlist`).set(as('c')).expect(200);
    expect((await http.get(`/api/events/${ev.id}/waitlist`).set(as('c')).expect(200)).body).toEqual({ joined: false, status: null, position: null, waiting: 0 });
    await http.patch(`/api/events/${ev.id}`).set(as('host')).send({ max_capacity: 5 }).expect(200);
    await new Promise((r) => setTimeout(r, 300));
    expect(await prisma.rsvps.count({ where: { event_id: ev.id, status: 'confirmed' } })).toBe(1);
    await http.get(`/api/events/${randomUUID()}/waitlist`).set(as('c')).expect(404);
  });

  it('paid event: a refunded ticket notifies the next person in line once', async () => {
    const ev = await prisma.events.create({
      data: { host_id: users.host.id, name: 'Sold Out Concert', status: 'published', start_date: soon(), is_paid: true },
    });
    const tt = await prisma.ticket_types.create({ data: { event_id: ev.id, name: 'GA', price_cents: 2000, quantity: 1, sold: 1 } });
    const ticket = await prisma.tickets.create({
      data: { event_id: ev.id, ticket_type_id: tt.id, user_id: users.a.id, quantity: 1, status: 'confirmed', total_charged_cents: 2140, unit_price_cents: 2000, platform_fee_cents: 140, stripe_fee_cents: 92, host_receives_cents: 1908 },
    });
    await http.post(`/api/events/${ev.id}/waitlist`).set(as('b')).expect(200);
    await http.post(`/api/events/${ev.id}/waitlist`).set(as('c')).expect(200);

    await app.get(PaymentsService).markRefunded({ id: ticket.id });
    const told = await until(() => prisma.notifications.findFirst({ where: { user_id: users.b.id, type: 'waitlist_spot' } }));
    expect(told?.title).toBe('Tickets are available — Sold Out Concert');
    expect((await http.get(`/api/events/${ev.id}/waitlist`).set(as('b')).expect(200)).body).toMatchObject({ joined: true, status: 'notified', position: null });
    // the one open seat is being held for b, so c isn't told yet
    await app.get(PaymentsService).markRefunded({ id: ticket.id });
    await new Promise((r) => setTimeout(r, 300));
    expect(await prisma.notifications.count({ where: { user_id: users.c.id, type: 'waitlist_spot' } })).toBe(0);
  });
});
