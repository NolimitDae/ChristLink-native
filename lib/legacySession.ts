import { Platform } from 'react-native';
import { ApiError, exchangeLegacySession } from './api';
import { logger } from './logger';
import { sessionFromTokens, setSession, type StoredSession } from './session';

/**
 * Website switch-over (docs/CUTOVER.md). The old christlinksocial.com stored its Supabase session in localStorage under
 * `sb-<project>-auth-token`. The new web app runs on the same domain, so on a visitor's first load it hands that
 * session's refresh token to the API (which has Supabase confirm it) and continues with a new session: no sign-in.
 * The old entry is removed once the API has answered either way; on a network or server error it's kept for next time.
 */
const LEGACY_KEY = /^sb-[a-z0-9]+-auth-token$/;

type KeyStore = Pick<Storage, 'length' | 'key' | 'getItem'>;

export function findLegacyRefreshToken(store: KeyStore): { key: string; refreshToken: string } | null {
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i);
    if (!key || !LEGACY_KEY.test(key)) continue;
    try {
      const raw = JSON.parse(store.getItem(key) ?? 'null') as
        | { refresh_token?: unknown; currentSession?: { refresh_token?: unknown } }
        | null;
      // supabase-js v2 stores the session itself; v1 wrapped it in currentSession
      const token = raw?.refresh_token ?? raw?.currentSession?.refresh_token;
      if (typeof token === 'string' && token) return { key, refreshToken: token };
    } catch {
      // not JSON: not a session we can use
    }
  }
  return null;
}

export async function takeOverLegacySession(): Promise<StoredSession | null> {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return null;
  let found: { key: string; refreshToken: string } | null = null;
  try {
    found = findLegacyRefreshToken(localStorage);
  } catch {
    return null; // storage blocked
  }
  if (!found) return null;
  try {
    const res = await exchangeLegacySession(found.refreshToken);
    const session = sessionFromTokens(res, { id: res.user.id, email: res.user.email });
    await setSession(session);
    localStorage.removeItem(found.key);
    logger.info('Old website session carried over');
    return session;
  } catch (err) {
    if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
      localStorage.removeItem(found.key); // expired, unknown account or feature off: sign in with email as usual
    } else {
      logger.warn('Old website session not carried over yet', { error: String(err) });
    }
    return null;
  }
}
