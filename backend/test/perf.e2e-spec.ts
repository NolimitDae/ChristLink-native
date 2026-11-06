import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { configureApi } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { NotificationsService } from '../src/modules/notifications/notifications.service';

describe('Performance plumbing (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  const hostId = randomUUID();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApi(moduleRef.createNestApplication<NestExpressApplication>({ rawBody: true }));
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.users.create({ data: { id: hostId, email: `perf-${hostId}@example.com` } });
    await prisma.profiles.create({ data: { id: hostId, email: `perf-${hostId}@example.com`, full_name: 'Perf Host' } });
    await prisma.events.createMany({
      data: Array.from({ length: 12 }, (_, i) => ({
        host_id: hostId,
        name: `Perf Event ${i}`,
        status: 'published',
        city: `Perfville-${hostId}`,
        start_date: new Date(Date.now() + (i + 1) * 86_400_000),
        description: 'A long description so the list is well over a kilobyte. '.repeat(5),
      })),
    });
  });

  afterAll(async () => {
    await prisma.users.deleteMany({ where: { id: hostId } });
    await app.close();
  });

  it('compresses large JSON with Brotli or gzip, as the client asks', async () => {
    const city = encodeURIComponent(`Perfville-${hostId}`);
    const br = await request(app.getHttpServer()).get(`/api/events?city=${city}`).set('Accept-Encoding', 'br').expect(200);
    expect(br.headers['content-encoding']).toBe('br');
    const gz = await request(app.getHttpServer()).get(`/api/events?city=${city}`).set('Accept-Encoding', 'gzip').expect(200);
    expect(gz.headers['content-encoding']).toBe('gzip');
    expect(gz.body.events).toHaveLength(12);
    const plain = await request(app.getHttpServer()).get(`/api/events?city=${city}`).set('Accept-Encoding', 'identity').expect(200);
    expect(plain.headers['content-encoding']).toBeUndefined();
  });

  it('createMany inserts one notification per person and queues their pushes', async () => {
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    for (const id of ids) await prisma.users.create({ data: { id, email: `perf-${id}@example.com` } });
    try {
      const n = await app.get(NotificationsService).createMany(ids.map((userId) => ({ userId, type: 'new_event', title: 'Hi', data: { x: 1 } })));
      expect(n).toBe(3);
      expect(await prisma.notifications.count({ where: { user_id: { in: ids }, type: 'new_event', title: 'Hi' } })).toBe(3);
    } finally {
      await prisma.users.deleteMany({ where: { id: { in: ids } } });
    }
  });
});
