import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { storage } from '../lib/storage';
import { FeatureError, getBlockedIds, getSettings } from '../lib/features';
import type { UserSettings } from '../lib/types';
import { useAuth } from './AuthContext';

interface AppDataValue {
  online: boolean;
  savedIds: Set<string>;
  toggleSaved: (eventId: string) => void;
  blockedIds: Set<string>;
  refreshBlocked: () => Promise<void>;
  hiddenPostIds: Set<string>;
  hidePost: (postId: string) => void;
  settings: UserSettings | null;
  /** 'notSetUp' means the database migration for settings isn't applied yet. */
  settingsStatus: 'signedOut' | 'loading' | 'ready' | 'notSetUp' | 'error';
  setSettings: (s: UserSettings | null) => void;
  refreshSettings: () => Promise<void>;
}

const AppDataContext = createContext<AppDataValue | null>(null);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [online, setOnline] = useState(true);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [hiddenPostIds, setHidden] = useState<Set<string>>(new Set());
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [settingsStatus, setSettingsStatus] = useState<AppDataValue['settingsStatus']>('signedOut');

  useEffect(() => {
    const unsub = NetInfo.addEventListener(state => {
      setOnline(state.isConnected !== false && state.isInternetReachable !== false);
    });
    storage.getSavedEventIds().then(ids => setSavedIds(new Set(ids)));
    storage.getHiddenPostIds().then(ids => setHidden(new Set(ids)));
    return unsub;
  }, []);

  const refreshBlocked = useCallback(async () => {
    setBlockedIds(new Set(await getBlockedIds()));
  }, []);

  const refreshSettings = useCallback(async () => {
    setSettingsStatus(prev => (prev === 'ready' ? prev : 'loading'));
    try {
      setSettings(await getSettings());
      setSettingsStatus('ready');
    } catch (err) {
      setSettings(null);
      setSettingsStatus(err instanceof FeatureError && err.notSetUp ? 'notSetUp' : 'error');
    }
  }, []);

  useEffect(() => {
    if (userId) {
      refreshBlocked();
      refreshSettings();
    } else {
      setBlockedIds(new Set());
      setSettings(null);
      setSettingsStatus('signedOut');
    }
  }, [userId, refreshBlocked, refreshSettings]);

  const toggleSaved = useCallback((eventId: string) => {
    setSavedIds(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      storage.setSavedEventIds([...next]);
      return next;
    });
  }, []);

  const hidePost = useCallback((postId: string) => {
    setHidden(prev => {
      const next = new Set(prev).add(postId);
      storage.setHiddenPostIds([...next]);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ online, savedIds, toggleSaved, blockedIds, refreshBlocked, hiddenPostIds, hidePost, settings, settingsStatus, setSettings, refreshSettings }),
    [online, savedIds, toggleSaved, blockedIds, refreshBlocked, hiddenPostIds, hidePost, settings, settingsStatus, refreshSettings],
  );
  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider');
  return ctx;
}
