import { JwtService } from '@nestjs/jwt';
import { AuthService, hashToken } from './auth.service';

const SB_URL = 'https://old.supabase.co';
const USER = { id: '11111111-1111-4111-8111-111111111111', email: 'grace@example.com' };

function fakePrisma(users: { id: string; email: string }[]) {
  const tokens: { token_hash: string; user_id: string }[] = [];
  return {
    tokens,
    users: {
      findUnique: async ({ where }: { where: { id?: string; email?: string } }) =>
        users.find((u) => (where.id ? u.id === where.id : u.email === where.email)) ?? null,
      update: async () => ({}),
    },
    profiles: { findUnique: async ({ where }: { where: { id: string } }) => ({ id: where.id, full_name: 'Grace' }) },
    refresh_tokens: {
      create: async ({ data }: { data: { token_hash: string; user_id: string } }) => {
        tokens.push(data);
        return { id: 'rt1', ...data };
      },
    },
  };
}

describe('AuthService.legacyExchange (website switch-over)', () => {
  const saved = { ...process.env };
  let fetchMock: jest.Mock;

  beforeEach(() => {
    process.env.LEGACY_SUPABASE_URL = `${SB_URL}/`;
    process.env.LEGACY_SUPABASE_ANON_KEY = 'anon-key';
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  const make = (users = [USER]) => {
    const prisma = fakePrisma(users);
    const jwt = new JwtService({ secret: 'test-secret', signOptions: { expiresIn: 3600 } });
    return { prisma, auth: new AuthService(prisma as never, jwt, {} as never, {} as never) };
  };
  const supabaseSays = (status: number, body: unknown) =>
    fetchMock.mockResolvedValueOnce({ ok: status < 400, status, json: async () => body } as Response);

  it('trades a valid Supabase session for a session on the imported account', async () => {
    const { auth, prisma } = make();
    supabaseSays(200, { access_token: 'sb-access', user: { id: USER.id, email: 'Grace@Example.com' } });
    fetchMock.mockResolvedValueOnce({ ok: true, status: 204 }); // logout of the old session

    const res = await auth.legacyExchange('old-refresh');

    expect(res.user).toMatchObject({ id: USER.id, email: USER.email, profile: { id: USER.id } });
    expect(res.accessToken).toBeTruthy();
    expect(res).not.toHaveProperty('refreshTokenId');
    expect(prisma.tokens[0]).toMatchObject({ user_id: USER.id, token_hash: hashToken(res.refreshToken) });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${SB_URL}/auth/v1/token?grant_type=refresh_token`);
    expect(init.headers).toMatchObject({ apikey: 'anon-key' });
    expect(JSON.parse(init.body)).toEqual({ refresh_token: 'old-refresh' });
    expect(fetchMock.mock.calls[1][0]).toBe(`${SB_URL}/auth/v1/logout?scope=local`);
  });

  it('finds the account by email when the id differs', async () => {
    const { auth } = make();
    supabaseSays(200, { user: { id: '22222222-2222-4222-8222-222222222222', email: USER.email } });
    const res = await auth.legacyExchange('old-refresh');
    expect(res.user.id).toBe(USER.id);
  });

  it('never creates an account that was not imported', async () => {
    const { auth, prisma } = make([]);
    supabaseSays(200, { user: { id: USER.id, email: USER.email } });
    await expect(auth.legacyExchange('old-refresh')).rejects.toMatchObject({ status: 401 });
    expect(prisma.tokens).toHaveLength(0);
  });

  it('rejects a token Supabase refuses', async () => {
    const { auth } = make();
    supabaseSays(400, { error: 'invalid_grant' });
    await expect(auth.legacyExchange('stolen-or-expired')).rejects.toMatchObject({ status: 401 });
  });

  it('asks the client to retry later when Supabase is down', async () => {
    const { auth } = make();
    fetchMock.mockRejectedValueOnce(new Error('ECONNRESET'));
    await expect(auth.legacyExchange('old-refresh')).rejects.toMatchObject({ status: 503 });
    supabaseSays(502, {});
    await expect(auth.legacyExchange('old-refresh')).rejects.toMatchObject({ status: 503 });
  });

  it('validates input and is off without configuration', async () => {
    const { auth } = make();
    await expect(auth.legacyExchange('')).rejects.toMatchObject({ status: 400 });
    await expect(auth.legacyExchange({})).rejects.toMatchObject({ status: 400 });
    delete process.env.LEGACY_SUPABASE_URL;
    await expect(auth.legacyExchange('old-refresh')).rejects.toMatchObject({ status: 404 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
