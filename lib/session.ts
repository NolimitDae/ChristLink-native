/**
 * The signed-in session for the Railway API: tokens in Keychain/Keystore (expo-secure-store),
 * a memory copy for every request, and one shared refresh (refresh tokens rotate; a reused one revokes the chain).
 */
import * as SecureStore from 'expo-secure-store';
import { API_BASE, API_TIMEOUT_MS } from './constants';
import { logger } from './logger';

export interface StoredSession {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms when the access token expires. */
  expiresAt: number;
  user: { id: string; email: string };
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  /** Seconds. */
  expiresIn: number;
}

const KEY = 'cl.session';
const REFRESH_MARGIN_MS = 60_000;

// SecureStore rejects values over ~2KB, so large values are split into chunks.
const CHUNK = 1800;

/**
 * Chunks are written under a new generation and only then does the pointer (`<key>__n` = "gen:count") switch,
 * so a kill mid-write leaves the previous value readable.
 */
export const chunkedSecureStore = {
  async getItem(key: string): Promise<string | null> {
    const ptr = await SecureStore.getItemAsync(`${key}__n`);
    if (ptr === null) return null;
    const [gen, n] = ptr.split(':');
    const parts = await Promise.all(
      Array.from({ length: Number(n) }, (_, i) => SecureStore.getItemAsync(`${key}__${gen}_${i}`)),
    );
    return parts.some(p => p === null) ? null : parts.join('');
  },
  async setItem(key: string, value: string): Promise<void> {
    const old = await SecureStore.getItemAsync(`${key}__n`);
    const [oldGen, oldN] = old ? old.split(':') : ['b', '0'];
    const gen = oldGen === 'a' ? 'b' : 'a';
    const count = Math.max(1, Math.ceil(value.length / CHUNK));
    for (let i = 0; i < count; i++) {
      await SecureStore.setItemAsync(`${key}__${gen}_${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK));
    }
    await SecureStore.setItemAsync(`${key}__n`, `${gen}:${count}`);
    await removeGen(key, oldGen, Number(oldN));
  },
  async removeItem(key: string): Promise<void> {
    const old = await SecureStore.getItemAsync(`${key}__n`);
    await SecureStore.deleteItemAsync(`${key}__n`);
    if (old) {
      const [gen, n] = old.split(':');
      await removeGen(key, gen, Number(n));
    }
  },
};

async function removeGen(key: string, gen: string, count: number): Promise<void> {
  await Promise.all(Array.from({ length: count }, (_, i) => SecureStore.deleteItemAsync(`${key}__${gen}_${i}`)));
}

// ── In-memory session + listeners ────────────────────────────
let current: StoredSession | null = null;
let loading: Promise<StoredSession | null> | null = null;
let refreshing: Promise<StoredSession | null> | null = null;
const listeners = new Set<(s: StoredSession | null) => void>();

export function getSession(): StoredSession | null {
  return current;
}

export function onSessionChange(listener: (s: StoredSession | null) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function setSession(s: StoredSession | null): Promise<void> {
  current = s;
  listeners.forEach(l => l(s));
  try {
    if (s) await chunkedSecureStore.setItem(KEY, JSON.stringify(s));
    else await chunkedSecureStore.removeItem(KEY);
  } catch (err) {
    logger.warn('Session not persisted', { error: String(err) });
  }
}

/** Reads the stored session once at startup; requests made meanwhile wait for it. */
export function loadSession(): Promise<StoredSession | null> {
  loading ??= chunkedSecureStore
    .getItem(KEY)
    .then(raw => {
      const s = raw ? (JSON.parse(raw) as StoredSession) : null;
      current = s?.accessToken && s.refreshToken && s.user?.id ? s : null;
      return current;
    })
    .catch(err => {
      logger.warn('Stored session unreadable', { error: String(err) });
      return null;
    });
  return loading;
}

export function sessionFromTokens(t: TokenResponse, user: StoredSession['user'], now = Date.now()): StoredSession {
  return { accessToken: t.accessToken, refreshToken: t.refreshToken, expiresAt: now + t.expiresIn * 1000, user };
}

/**
 * Exchanges the refresh token for a new pair. Concurrent callers share one request.
 * The server rejecting it (4xx) signs out locally; a network/5xx failure keeps the session for a later try.
 */
export function refreshSession(): Promise<StoredSession | null> {
  refreshing ??= doRefresh().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

async function doRefresh(): Promise<StoredSession | null> {
  if (loading) await loading;
  const s = current;
  if (!s) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: s.refreshToken }),
      signal: controller.signal as RequestInit['signal'],
    });
    if (res.status >= 400 && res.status < 500) {
      logger.info('Refresh rejected, signing out', { status: res.status });
      // Only clear if nobody replaced the session meanwhile (e.g. a fresh sign-in).
      if (current === s) await setSession(null);
      return null;
    }
    if (!res.ok) throw new Error(`refresh ${res.status}`);
    const next = sessionFromTokens((await res.json()) as TokenResponse, s.user);
    if (current !== s) return current;
    await setSession(next);
    return next;
  } catch (err) {
    logger.warn('Token refresh failed', { error: String(err) });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** A usable access token: refreshes first when it expires within 60 s. Null when signed out. */
export async function getAccessToken(): Promise<string | null> {
  if (loading) await loading;
  if (!current) return null;
  if (current.expiresAt - Date.now() < REFRESH_MARGIN_MS) {
    const next = await refreshSession();
    // Offline: keep using the old token (signed out on rejection makes `current` null).
    return next?.accessToken ?? current?.accessToken ?? null;
  }
  return current.accessToken;
}
