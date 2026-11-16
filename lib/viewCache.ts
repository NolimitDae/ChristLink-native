import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Last good copy of a public list (events, verse of the day), kept in memory and on the device. Screens show it at
 * once and refresh in the background, so coming back to a tab or reopening the app doesn't start from skeletons.
 * Public data only: nothing tied to the signed-in person goes here.
 */
const PREFIX = 'cl.view.';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface Entry {
  at: number;
  data: unknown;
}
const mem = new Map<string, Entry>();

const fresh = (e: Entry | undefined | null, now: number): e is Entry => !!e && now - e.at < MAX_AGE_MS && now >= e.at;

/** Memory only (synchronous), for a screen's first render. */
export function peekCache<T>(key: string, now = Date.now()): T | null {
  const e = mem.get(key);
  return fresh(e, now) ? (e.data as T) : null;
}

/** Memory, then the device. Resolves null when there is nothing recent. */
export async function readCache<T>(key: string, now = Date.now()): Promise<T | null> {
  const hit = peekCache<T>(key, now);
  if (hit !== null) return hit;
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    const e = raw ? (JSON.parse(raw) as Entry) : null;
    if (!fresh(e, now)) return null;
    mem.set(key, e);
    return e.data as T;
  } catch {
    return null;
  }
}

export function writeCache(key: string, data: unknown, now = Date.now()): void {
  const e: Entry = { at: now, data };
  mem.set(key, e);
  // Best effort: a full or blocked store just means the next visit loads normally
  AsyncStorage.setItem(PREFIX + key, JSON.stringify(e)).catch(() => undefined);
}

/** Test helper. */
export function clearViewCacheMemory(): void {
  mem.clear();
}

/** The default events list (no filters), shared by Discover and the Events tab. */
export const EVENTS_DEFAULT_KEY = 'events.default';

/** Verse of the day as last shown, valid for the local calendar day it was saved on. */
export const VERSE_KEY = 'verse.today';
export const localDay = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
