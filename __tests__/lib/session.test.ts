const mockFetch = jest.fn();
global.fetch = mockFetch;

const mockStore = new Map<string, string>();
const mockOps: string[] = [];
let mockFailSetOn: string | null = null;
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (k: string) => mockStore.get(k) ?? null),
  setItemAsync: jest.fn(async (k: string, v: string) => {
    if (k === mockFailSetOn) throw new Error('killed');
    mockOps.push(`set ${k}`);
    mockStore.set(k, v);
  }),
  deleteItemAsync: jest.fn(async (k: string) => {
    mockOps.push(`del ${k}`);
    mockStore.delete(k);
  }),
}));
jest.mock('../../lib/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../../lib/constants', () => ({ API_BASE: 'https://api.test', API_TIMEOUT_MS: 5000, API_MAX_RETRIES: 0 }));

import { ApiError, apiFetch } from '../../lib/api';
import { chunkedSecureStore, getAccessToken, getSession, setSession, type StoredSession } from '../../lib/session';

const respond = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => JSON.stringify(body),
  json: async () => body,
});
const session = (expiresInMs: number): StoredSession => ({
  accessToken: 'old-access',
  refreshToken: 'old-refresh',
  expiresAt: Date.now() + expiresInMs,
  user: { id: 'u1', email: 'a@b.co' },
});
const refreshCalls = () => mockFetch.mock.calls.filter(([url]) => String(url).endsWith('/api/auth/refresh'));

beforeEach(async () => {
  mockFetch.mockReset();
  await setSession(null);
  mockStore.clear();
  mockOps.length = 0;
  mockFailSetOn = null;
});

describe('chunkedSecureStore', () => {
  it('writes every new chunk before switching the pointer, and deletes old chunks after', async () => {
    await chunkedSecureStore.setItem('k', 'x'.repeat(4000));
    mockOps.length = 0;
    const next = 'y'.repeat(4000);
    await chunkedSecureStore.setItem('k', next);

    const pointer = mockOps.indexOf('set k__n');
    const newChunks = mockOps.filter(o => o.startsWith('set k__b_')).map(o => mockOps.indexOf(o));
    const oldDeletes = mockOps.filter(o => o.startsWith('del k__a_')).map(o => mockOps.indexOf(o));
    expect(newChunks).toHaveLength(3);
    expect(Math.max(...newChunks)).toBeLessThan(pointer);
    expect(oldDeletes).toHaveLength(3);
    expect(Math.min(...oldDeletes)).toBeGreaterThan(pointer);
    await expect(chunkedSecureStore.getItem('k')).resolves.toBe(next);
  });

  it('keeps the previous value when killed mid-write', async () => {
    await chunkedSecureStore.setItem('k', 'old'.repeat(1000));
    mockFailSetOn = 'k__b_1';
    await expect(chunkedSecureStore.setItem('k', 'new'.repeat(1000))).rejects.toThrow('killed');
    await expect(chunkedSecureStore.getItem('k')).resolves.toBe('old'.repeat(1000));
  });

  it('removes all chunks', async () => {
    await chunkedSecureStore.setItem('k', 'z'.repeat(2000));
    await chunkedSecureStore.removeItem('k');
    expect(mockStore.size).toBe(0);
    await expect(chunkedSecureStore.getItem('k')).resolves.toBeNull();
  });
});

describe('token refresh', () => {
  it('returns the stored token while it is fresh', async () => {
    await setSession(session(30 * 60_000));
    await expect(getAccessToken()).resolves.toBe('old-access');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('shares one in-flight refresh between concurrent callers', async () => {
    await setSession(session(10_000)); // inside the 60 s margin
    mockFetch.mockResolvedValue(respond(200, { accessToken: 'new-access', refreshToken: 'new-refresh', expiresIn: 3600 }));
    const tokens = await Promise.all([getAccessToken(), getAccessToken(), getAccessToken()]);
    expect(tokens).toEqual(['new-access', 'new-access', 'new-access']);
    expect(refreshCalls()).toHaveLength(1);
    expect(JSON.parse(String(refreshCalls()[0][1].body))).toEqual({ refreshToken: 'old-refresh' });
    expect(getSession()?.refreshToken).toBe('new-refresh');
  });

  it('on a 401 refreshes once and retries the request with the new token', async () => {
    await setSession(session(30 * 60_000));
    mockFetch
      .mockResolvedValueOnce(respond(401, { error: 'expired' }))
      .mockResolvedValueOnce(respond(200, { accessToken: 'new-access', refreshToken: 'new-refresh', expiresIn: 3600 }))
      .mockResolvedValueOnce(respond(200, { ok: true }));
    await expect(apiFetch('/api/tickets/confirm-by-intent', { method: 'POST', body: '{}' })).resolves.toEqual({ ok: true });
    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe('Bearer old-access');
    expect(mockFetch.mock.calls[2][1].headers.Authorization).toBe('Bearer new-access');
  });

  it('does not loop when the retry is also rejected', async () => {
    await setSession(session(30 * 60_000));
    mockFetch
      .mockResolvedValueOnce(respond(401, { error: 'expired' }))
      .mockResolvedValueOnce(respond(200, { accessToken: 'new-access', refreshToken: 'new-refresh', expiresIn: 3600 }))
      .mockResolvedValueOnce(respond(401, { error: 'nope' }));
    await expect(apiFetch('/api/profile')).rejects.toMatchObject({ status: 401 });
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('signs out locally when the server rejects the refresh token', async () => {
    await setSession(session(30 * 60_000));
    mockFetch
      .mockResolvedValueOnce(respond(401, { error: 'expired' }))
      .mockResolvedValueOnce(respond(401, { error: 'Session expired. Please sign in again.' }));
    await expect(apiFetch('/api/profile')).rejects.toBeInstanceOf(ApiError);
    expect(getSession()).toBeNull();
    expect(mockStore.size).toBe(0);
    await expect(getAccessToken()).resolves.toBeNull();
  });

  it('keeps the session when the refresh fails on the network', async () => {
    await setSession(session(10_000));
    mockFetch.mockRejectedValueOnce(new TypeError('Network request failed'));
    await expect(getAccessToken()).resolves.toBe('old-access');
    expect(getSession()?.refreshToken).toBe('old-refresh');
  });
});
