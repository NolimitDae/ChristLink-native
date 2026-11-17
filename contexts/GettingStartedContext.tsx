import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { celebrateSetup, getGettingStarted, hideSetupChecklist, markWelcomed as markWelcomedApi } from '../lib/features';
import { haptic } from '../lib/haptics';
import { logger } from '../lib/logger';
import type { GettingStarted } from '../lib/types';
import { useAppData } from './AppDataContext';
import { useAuth } from './AuthContext';

interface GettingStartedValue {
  /** null while signed out, loading, or before the backend has the route. */
  status: GettingStarted | null;
  /** Re-reads the checklist; when everything is newly done, claims the thank-you and opens the celebration. */
  refresh: () => Promise<void>;
  /** Re-reads at most once every `minGapMs` (used on navigation). */
  refreshSoon: (minGapMs?: number) => void;
  hide: () => Promise<void>;
  markWelcomed: () => Promise<void>;
  celebrating: boolean;
  endCelebration: () => void;
}

const Ctx = createContext<GettingStartedValue | null>(null);

/**
 * A new account's welcome tour and setup checklist (lib/gettingStarted.ts, components/setup/*). The server works out
 * which steps are done, so this only asks it again after things that can finish a step.
 */
export function GettingStartedProvider({ children }: { children: React.ReactNode }) {
  const { session, profile } = useAuth();
  const { settings } = useAppData();
  const userId = session?.user.id;
  const [status, setStatus] = useState<GettingStarted | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const inflight = useRef<Promise<void> | null>(null);
  const lastRun = useRef(0);
  const userRef = useRef(userId);
  userRef.current = userId;

  const refresh = useCallback(async () => {
    if (!userRef.current) return;
    if (inflight.current) return inflight.current;
    const forUser = userRef.current;
    lastRun.current = Date.now();
    inflight.current = (async () => {
      try {
        const next = await getGettingStarted();
        if (userRef.current !== forUser) return;
        setStatus(next);
        if (next.celebrate) {
          const { celebrate } = await celebrateSetup();
          if (userRef.current !== forUser) return;
          setStatus({ ...next, celebrate: false, show: false, completed_at: new Date().toISOString() });
          if (celebrate) {
            // A moment's pause: the step was often finished in a sheet that is still closing, and iOS won't
            // present a second modal over one that is going away
            setTimeout(() => {
              if (userRef.current !== forUser) return;
              haptic.success();
              setCelebrating(true);
            }, 1200);
          }
        }
      } catch (err) {
        // notSetUp: the API doesn't have the route yet; anything else: try again on the next refresh
        logger.warn('Getting started not loaded', { error: String(err) });
      } finally {
        inflight.current = null;
      }
    })();
    return inflight.current;
  }, []);

  const refreshSoon = useCallback(
    (minGapMs = 15_000) => {
      if (Date.now() - lastRun.current >= minGapMs) refresh();
    },
    [refresh],
  );

  // A different person (or nobody) signed in: start over
  useEffect(() => {
    setStatus(null);
    setCelebrating(false);
    if (userId) refresh();
  }, [userId, refresh]);

  // Things that can finish a step without passing through a screen that refreshes: photo, bio, church
  useEffect(() => {
    if (userId && status?.show) refreshSoon(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.avatar_url, profile?.banner_url, profile?.bio, profile?.hobbies, profile?.connect_tags?.length, settings?.home_church_id]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active' && userRef.current) refreshSoon();
    });
    return () => sub.remove();
  }, [refreshSoon]);

  const hide = useCallback(async () => {
    setStatus(s => (s ? { ...s, show: false } : s));
    try {
      setStatus(await hideSetupChecklist());
    } catch (err) {
      logger.warn('Checklist not hidden', { error: String(err) });
    }
  }, []);

  const markWelcomed = useCallback(async () => {
    setStatus(s => (s ? { ...s, welcome: false } : s));
    try {
      setStatus(await markWelcomedApi());
    } catch (err) {
      logger.warn('Welcome not saved', { error: String(err) });
    }
  }, []);

  const endCelebration = useCallback(() => setCelebrating(false), []);

  const value = useMemo(
    () => ({ status, refresh, refreshSoon, hide, markWelcomed, celebrating, endCelebration }),
    [status, refresh, refreshSoon, hide, markWelcomed, celebrating, endCelebration],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGettingStarted(): GettingStartedValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useGettingStarted must be used inside GettingStartedProvider');
  return v;
}
