import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { configureApi } from '../src/bootstrap';
import { OtpService } from '../src/modules/auth/otp.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { REDIS } from '../src/redis';

describe('Auth flow (e2e)', () => {
  let app: NestExpressApplication;
  let http: ReturnType<typeof request>;
  const codes = new Map<string, string>();
  const email = `e2e+${Date.now()}@example.com`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApi(moduleRef.createNestApplication<NestExpressApplication>({ rawBody: true }));
    await app.init();
    // Capture codes instead of reading the dev log
    const otp = app.get(OtpService);
    const issue = otp.issue.bind(otp);
    jest.spyOn(otp, 'issue').mockImplementation(async (e: string, name?: string) => {
      const code = await issue(e, name);
      codes.set(e, code);
      return code;
    });
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    const prisma = app.get(PrismaService);
    await prisma.users.deleteMany({ where: { email: { in: [email, 'review@example.com'] } } });
    await app.close();
  });

  it('serves health at /health and /api/health', async () => {
    for (const path of ['/health', '/api/health']) {
      const res = await http.get(path).expect(200);
      expect(res.body).toMatchObject({ status: 'ok', service: 'christlink' });
    }
  });

  it('signup → verify-otp → authenticated GET → refresh → signout', async () => {
    const signup = await http.post('/api/auth/signup').send({ email, fullName: 'E2E Tester' }).expect(200);
    expect(signup.body).toEqual({ success: true, message: expect.any(String) });

    await http.post('/api/auth/verify-otp').send({ email, token: '12' }).expect(400, { error: 'Invalid or expired code. Please try again.' });

    const verify = await http.post('/api/auth/verify-otp').send({ email, token: codes.get(email) }).expect(200);
    expect(verify.body).toMatchObject({
      success: true,
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      expiresIn: 3600,
      user: { id: expect.any(String), email, profile: { email, full_name: 'E2E Tester', role: 'attendee' } },
    });
    const { accessToken, refreshToken, user } = verify.body;

    await http.get('/api/auth/me').expect(401, { error: 'Authentication required.' });
    await http.get('/api/auth/me').set('Authorization', 'Bearer nope').expect(401, { error: 'Invalid or expired session.' });
    await http.get('/api/auth/me').set('Authorization', `Bearer ${accessToken}`).expect(200, { id: user.id, email });

    const refreshed = await http.post('/api/auth/refresh').send({ refreshToken }).expect(200);
    expect(refreshed.body).toEqual({ accessToken: expect.any(String), refreshToken: expect.any(String), expiresIn: 3600 });
    // The old token is rotated out; reusing it fails and revokes the new one too
    await http.post('/api/auth/refresh').send({ refreshToken }).expect(401);
    await http.post('/api/auth/refresh').send({ refreshToken: refreshed.body.refreshToken }).expect(401);

    // Fresh sign-in (after the 60 s resend cooldown), then sign out
    await http.post('/api/auth/signin').send({ email }).expect(429);
    await app.get(REDIS).del(`otp:cooldown:${email}`);
    await http.post('/api/auth/signin').send({ email: email.toUpperCase() }).expect(200);
    const again = await http.post('/api/auth/verify-otp').send({ email, token: codes.get(email) }).expect(200);
    expect(again.body.user.id).toBe(user.id);
    await http.post('/api/auth/signout').send({ refreshToken: again.body.refreshToken }).expect(200, { success: true });
    await http.post('/api/auth/refresh').send({ refreshToken: again.body.refreshToken }).expect(401);
  });

  it('accepts the fixed review code for REVIEW_EMAIL', async () => {
    await http.post('/api/auth/signin').send({ email: 'review@example.com' }).expect(200);
    const res = await http.post('/api/auth/verify-otp').send({ email: 'review@example.com', token: '424242' }).expect(200);
    expect(res.body.user.profile.full_name).toBe('review');
  });

  it('returns { error } for bad input', async () => {
    await http.post('/api/auth/signin').send({}).expect(400, { error: 'Email is required.' });
    await http.post('/api/auth/verify-otp').send({ email }).expect(400, { error: 'Email and code are required.' });
  });
});
