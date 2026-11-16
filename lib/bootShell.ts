import { Platform } from 'react-native';

interface BootEl {
  classList: { add: (c: string) => void; contains: (c: string) => boolean };
  remove: () => void;
}

/**
 * Website only: public/index.html paints a short "what is Christ Link" splash from plain HTML while the script loads.
 * Call this when the first screen is ready; it fades the splash out and removes it. No-op on iOS/Android.
 */
export function dismissBootShell(): void {
  if (Platform.OS !== 'web') return;
  const doc = (globalThis as unknown as { document?: { getElementById: (id: string) => BootEl | null } }).document;
  const el = doc?.getElementById('boot');
  if (!el || el.classList.contains('done')) return;
  el.classList.add('done');
  setTimeout(() => el.remove(), 250);
}
