/** Website switch-over: a visitor signed in on the old Supabase site stays signed in on the new web app. */
const mockExchange = jest.fn();
const mockSetSession = jest.fn(async (_s: unknown) => undefined);

jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));
jest.mock('../../lib/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../../lib/api', () => {
  class ApiError extends Error {
    status: number;
    constructor(message: string, code: number, _retryable?: boolean) {
      super(message);
      this.status = code;
    }
  }
  return { ApiError, exchangeLegacySession: (t: string) => mockExchange(t) };
});
jest.mock('../../lib/session', () => ({
  setSession: (s: unknown) => mockSetSession(s),
  sessionFromTokens: (t: { accessToken: string; refreshToken: string }, user: unknown) => ({ ...t, user }),
}));

import { ApiError } from '../../lib/api';
import { findLegacyRefreshToken, takeOverLegacySession } from '../../lib/legacySession';

function fakeStorage(entries: Record<string, string>) {
  const map = new Map(Object.entries(entries));
  return {
    map,
    get length() {
      return map.size;
    },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    removeItem: (k: string) => void map.delete(k),
  };
}

const OLD_KEY = 'sb-iqosvigdelnmarecpkkp-auth-token';
const OK = { accessToken: 'a', refreshToken: 'r', expiresIn: 3600, user: { id: 'u1', email: 'grace@example.com' } };

describe('findLegacyRefreshToken', () => {
  it('reads a supabase-js v2 session', () => {
    const s = fakeStorage({ theme: 'dark', [OLD_KEY]: JSON.stringify({ access_token: 'x', refresh_token: 'rt-1' }) });
    expect(findLegacyRefreshToken(s)).toEqual({ key: OLD_KEY, refreshToken: 'rt-1' });
  });

  it('reads the older currentSession shape', () => {
    const s = fakeStorage({ [OLD_KEY]: JSON.stringify({ currentSession: { refresh_token: 'rt-2' } }) });
    expect(findLegacyRefreshToken(s)?.refreshToken).toBe('rt-2');
  });

  it('ignores other keys, signed-out entries and junk', () => {
    expect(findLegacyRefreshToken(fakeStorage({ 'cl.session': '{"refresh_token":"mine"}' }))).toBeNull();
    expect(findLegacyRefreshToken(fakeStorage({ [OLD_KEY]: 'null' }))).toBeNull();
    expect(findLegacyRefreshToken(fakeStorage({ [OLD_KEY]: '{oops' }))).toBeNull();
  });
});

describe('takeOverLegacySession', () => {
  let store: ReturnType<typeof fakeStorage>;
  beforeEach(() => {
    mockExchange.mockReset();
    mockSetSession.mockClear();
    store = fakeStorage({ [OLD_KEY]: JSON.stringify({ refresh_token: 'rt-1' }) });
    (global as unknown as { localStorage: unknown }).localStorage = store;
  });

  it('exchanges the old session, saves the new one and removes the old entry', async () => {
    mockExchange.mockResolvedValueOnce(OK);
    const s = await takeOverLegacySession();
    expect(mockExchange).toHaveBeenCalledWith('rt-1');
    expect(s).toMatchObject({ accessToken: 'a', user: { id: 'u1', email: 'grace@example.com' } });
    expect(mockSetSession).toHaveBeenCalledWith(s);
    expect(store.map.has(OLD_KEY)).toBe(false);
  });

  it('drops the old entry when the API says no (expired, not imported, feature off)', async () => {
    mockExchange.mockRejectedValueOnce(new ApiError('Please sign in with your email.', 401, false));
    expect(await takeOverLegacySession()).toBeNull();
    expect(store.map.has(OLD_KEY)).toBe(false);
    expect(mockSetSession).not.toHaveBeenCalled();
  });

  it('keeps the old entry to retry when the API or network fails', async () => {
    mockExchange.mockRejectedValueOnce(new ApiError('Try again in a moment.', 503, true));
    expect(await takeOverLegacySession()).toBeNull();
    mockExchange.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    expect(await takeOverLegacySession()).toBeNull();
    expect(store.map.has(OLD_KEY)).toBe(true);
  });

  it('does nothing when there is no old session', async () => {
    store.map.clear();
    expect(await takeOverLegacySession()).toBeNull();
    expect(mockExchange).not.toHaveBeenCalled();
  });
});
