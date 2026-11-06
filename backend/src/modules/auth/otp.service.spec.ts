import { HttpException } from '@nestjs/common';
import { OTP_MAX_ATTEMPTS, OtpService } from './otp.service';

/** Just enough of ioredis for OtpService. */
class FakeRedis {
  store = new Map<string, string>();
  async set(k: string, v: string, ...args: unknown[]) {
    if (args.includes('NX') && this.store.has(k)) return null;
    this.store.set(k, v);
    return 'OK';
  }
  async get(k: string) {
    return this.store.get(k) ?? null;
  }
  async incr(k: string) {
    const n = Number(this.store.get(k) ?? 0) + 1;
    this.store.set(k, String(n));
    return n;
  }
  async del(...keys: string[]) {
    keys.forEach((k) => this.store.delete(k));
    return keys.length;
  }
  multi() {
    const ops: (() => Promise<unknown>)[] = [];
    const chain = {
      set: (...a: [string, string, ...unknown[]]) => (ops.push(() => this.set(...a)), chain),
      get: (k: string) => (ops.push(() => this.get(k)), chain),
      del: (k: string) => (ops.push(() => this.del(k)), chain),
      exec: async () => {
        const out: [null, unknown][] = [];
        for (const op of ops) out.push([null, await op()]);
        return out;
      },
    };
    return chain;
  }
}

const email = 'grace@example.com';

describe('OtpService', () => {
  let redis: FakeRedis;
  let otp: OtpService;
  beforeEach(() => {
    redis = new FakeRedis();
    otp = new OtpService(redis as never);
  });

  it('issues a 6-digit code and stores only its hash', async () => {
    const code = await otp.issue(email);
    expect(code).toMatch(/^\d{6}$/);
    const stored = redis.store.get(`otp:code:${email}`)!;
    expect(stored).not.toContain(code);
    expect(stored).toBe(otp.hash(email, code));
  });

  it('enforces the 60 s resend cooldown', async () => {
    await otp.issue(email);
    await expect(otp.issue(email)).rejects.toMatchObject({ status: 429 });
  });

  it('verifies the right code once and returns the signup name', async () => {
    const code = await otp.issue(email, 'Grace Hopper');
    await expect(otp.verify(email, code)).resolves.toEqual({ fullName: 'Grace Hopper' });
    await expect(otp.verify(email, code)).rejects.toBeInstanceOf(HttpException); // used codes are deleted
  });

  it('rejects a wrong code', async () => {
    const code = await otp.issue(email);
    const wrong = code === '000000' ? '000001' : '000000';
    await expect(otp.verify(email, wrong)).rejects.toMatchObject({ status: 400 });
  });

  it(`locks the code after ${OTP_MAX_ATTEMPTS} wrong attempts, even for the right code`, async () => {
    const code = await otp.issue(email);
    const wrong = code === '000000' ? '000001' : '000000';
    for (let i = 0; i < OTP_MAX_ATTEMPTS; i++) await expect(otp.verify(email, wrong)).rejects.toThrow();
    await expect(otp.verify(email, code)).rejects.toThrow('Too many attempts');
    expect(redis.store.has(`otp:code:${email}`)).toBe(false);
  });
});
