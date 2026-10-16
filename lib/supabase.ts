import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { SUPABASE_URL, SUPABASE_ANON } from './constants';
import { logger } from './logger';

if (!SUPABASE_URL || !SUPABASE_ANON) {
  logger.error('Supabase credentials are missing. Check your .env.local file.');
}

// SecureStore rejects values over ~2KB; Supabase sessions can exceed that, so store them in chunks.
const CHUNK = 1800;

async function removeChunks(key: string): Promise<void> {
  const count = Number((await SecureStore.getItemAsync(`${key}__n`)) ?? 0);
  await Promise.all(Array.from({ length: count }, (_, i) => SecureStore.deleteItemAsync(`${key}__${i}`)));
  await SecureStore.deleteItemAsync(`${key}__n`);
}

export const chunkedSecureStore = {
  async getItem(key: string): Promise<string | null> {
    const n = await SecureStore.getItemAsync(`${key}__n`);
    if (n === null) return SecureStore.getItemAsync(key);
    const parts = await Promise.all(
      Array.from({ length: Number(n) }, (_, i) => SecureStore.getItemAsync(`${key}__${i}`)),
    );
    return parts.some(p => p === null) ? null : parts.join('');
  },
  async setItem(key: string, value: string): Promise<void> {
    await removeChunks(key);
    await SecureStore.deleteItemAsync(key);
    const count = Math.ceil(value.length / CHUNK);
    await Promise.all(
      Array.from({ length: count }, (_, i) =>
        SecureStore.setItemAsync(`${key}__${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK)),
      ),
    );
    await SecureStore.setItemAsync(`${key}__n`, String(count));
  },
  async removeItem(key: string): Promise<void> {
    await removeChunks(key);
    await SecureStore.deleteItemAsync(key);
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    storage: chunkedSecureStore,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
