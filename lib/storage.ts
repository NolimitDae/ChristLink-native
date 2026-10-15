import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ThemePreference } from './theme';
import type { RSVP, Ticket } from './types';
import { logger } from './logger';

const KEYS = {
  theme: 'cl.theme',
  saved: 'cl.savedEvents',
  tickets: 'cl.ticketsCache',
  rsvps: 'cl.rsvpsCache',
  onboarding: 'cl.onboardingDone',
  hiddenPosts: 'cl.hiddenPosts',
  reminders: 'cl.scheduledReminders',
} as const;

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch (err) {
    logger.warn('storage read failed', { key, error: String(err) });
    return fallback;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    logger.warn('storage write failed', { key, error: String(err) });
  }
}

export const storage = {
  async getThemePreference(): Promise<ThemePreference> {
    const v = await readJson<string>(KEYS.theme, 'system');
    return v === 'light' || v === 'dark' ? v : 'system';
  },
  setThemePreference: (p: ThemePreference) => writeJson(KEYS.theme, p),

  getSavedEventIds: () => readJson<string[]>(KEYS.saved, []),
  setSavedEventIds: (ids: string[]) => writeJson(KEYS.saved, ids),

  getCachedTickets: () => readJson<Ticket[]>(KEYS.tickets, []),
  setCachedTickets: (t: Ticket[]) => writeJson(KEYS.tickets, t),

  getCachedRsvps: () => readJson<RSVP[]>(KEYS.rsvps, []),
  setCachedRsvps: (r: RSVP[]) => writeJson(KEYS.rsvps, r),

  getOnboardingDone: () => readJson<boolean>(KEYS.onboarding, false),
  setOnboardingDone: (v: boolean) => writeJson(KEYS.onboarding, v),

  getHiddenPostIds: () => readJson<string[]>(KEYS.hiddenPosts, []),
  setHiddenPostIds: (ids: string[]) => writeJson(KEYS.hiddenPosts, ids),

  getReminderMap: () => readJson<Record<string, string[]>>(KEYS.reminders, {}),
  setReminderMap: (m: Record<string, string[]>) => writeJson(KEYS.reminders, m),

  async clearUserData(): Promise<void> {
    await AsyncStorage.multiRemove([KEYS.saved, KEYS.tickets, KEYS.rsvps, KEYS.hiddenPosts, KEYS.reminders]);
  },
};
