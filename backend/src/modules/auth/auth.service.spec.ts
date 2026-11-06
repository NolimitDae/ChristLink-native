import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { AuthService, hashToken } from './auth.service';

interface Row {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
  replaced_by: string | null;
}

/** In-memory refresh_tokens table with the Prisma calls AuthService uses. */
function fakePrisma() {
  const rows: Row[] = [];
  const match = (r: Row, where: Partial<Row>) =>
    Object.entries(where).every(([k, v]) => (r as unknown as Record<string, unknown>)[k] === v);
  return {
    rows,
    refresh_tokens: {
      create: async ({ data }: { data: Omit<Row, 'id' | 'revoked_at' | 'replaced_by'> }) => {
        const row = { id: randomUUID(), revoked_at: null, replaced_by: null, ...data };
        rows.push(row);
        return row;
      },
      findUnique: async ({ where }: { where: Partial<Row> }) => {
        const r = rows.find((x) => match(x, where));
        return r ? { ...r, users: { email: 'grace@example.com' } } : null;
      },
      updateMany: async ({ where, data }: { where: Partial<Row>; data: Partial<Row> }) => {
        const hit = rows.filter((x) => match(x, where));
        hit.forEach((x) => Object.assign(x, data));
        return { count: hit.length };
      },
    },
  };
}

describe('AuthService refresh tokens', () => {
  let prisma: ReturnType<typeof fakePrisma>;
  let auth: AuthService;
  const userId = randomUUID();

  beforeEach(() => {
    prisma = fakePrisma();
    const jwt = new JwtService({ secret: 'test-secret', signOptions: { expiresIn: 3600 } });
    auth = new AuthService(prisma as never, jwt, {} as never, {} as never);
  });

  const login = () => (auth as unknown as { issueTokens(id: string, e: string) }).issueTokens(userId, 'grace@example.com');

  it('rotates: returns a new pair and revokes the old token', async () => {
    const first = await login();
    const second = await auth.refresh(first.refreshToken);
    expect(second.refreshToken).not.toBe(first.refreshToken);
    expect(second.expiresIn).toBe(3600);
    const old = prisma.rows.find((r) => r.token_hash === hashToken(first.refreshToken))!;
    const next = prisma.rows.find((r) => r.token_hash === hashToken(second.refreshToken))!;
    expect(old.revoked_at).not.toBeNull();
    expect(old.replaced_by).toBe(next.id);
    expect(next.revoked_at).toBeNull();
  });

  it('detects reuse of a rotated token and revokes the whole chain after it', async () => {
    const first = await login();
    const second = await auth.refresh(first.refreshToken);
    const third = await auth.refresh(second.refreshToken);
    await expect(auth.refresh(first.refreshToken)).rejects.toMatchObject({ status: 401 });
    expect(prisma.rows.every((r) => r.revoked_at)).toBe(true);
    await expect(auth.refresh(third.refreshToken)).rejects.toMatchObject({ status: 401 });
  });

  it('rejects unknown and expired tokens', async () => {
    await expect(auth.refresh('nope')).rejects.toMatchObject({ status: 401 });
    const t = await login();
    prisma.rows[0].expires_at = new Date(Date.now() - 1000);
    await expect(auth.refresh(t.refreshToken)).rejects.toMatchObject({ status: 401 });
  });

  it('signout revokes the token', async () => {
    const t = await login();
    await expect(auth.signout(t.refreshToken)).resolves.toEqual({ success: true });
    await expect(auth.refresh(t.refreshToken)).rejects.toMatchObject({ status: 401 });
  });
});
