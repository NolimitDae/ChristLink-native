jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearViewCacheMemory, localDay, peekCache, readCache, writeCache } from '../../lib/viewCache';

describe('viewCache: last good copy of public lists', () => {
  beforeEach(async () => {
    clearViewCacheMemory();
    await AsyncStorage.clear();
  });

  it('is empty until something is written, then answers from memory at once', () => {
    expect(peekCache('events.default')).toBeNull();
    writeCache('events.default', [{ id: 'e1' }]);
    expect(peekCache('events.default')).toEqual([{ id: 'e1' }]);
  });

  it('survives a restart through device storage', async () => {
    writeCache('events.default', [{ id: 'e1' }]);
    await Promise.resolve();
    clearViewCacheMemory();
    expect(peekCache('events.default')).toBeNull();
    expect(await readCache('events.default')).toEqual([{ id: 'e1' }]);
    // …and is back in memory for the next synchronous read
    expect(peekCache('events.default')).toEqual([{ id: 'e1' }]);
  });

  it('ignores copies older than a day and unreadable entries', async () => {
    const now = Date.now();
    writeCache('events.default', [1], now - 25 * 3_600_000);
    expect(peekCache('events.default', now)).toBeNull();
    expect(await readCache('events.default', now)).toBeNull();
    await AsyncStorage.setItem('cl.view.broken', '{not json');
    expect(await readCache('broken')).toBeNull();
  });

  it('localDay changes at local midnight', () => {
    expect(localDay(new Date(2026, 10, 16, 23, 59))).toBe('2026-11-16');
    expect(localDay(new Date(2026, 10, 17, 0, 1))).toBe('2026-11-17');
  });
});
