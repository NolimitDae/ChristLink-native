import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import * as Sentry from '@sentry/react-native';
import { supabase } from '../lib/supabase';
import { getProfile } from '../lib/api';
import { storage } from '../lib/storage';
import { logger } from '../lib/logger';
import type { Profile } from '../lib/types';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  isVerifiedHost: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (accessToken: string) => {
    try {
      setProfile(await getProfile(accessToken));
    } catch (err) {
      logger.warn('Profile not loaded', { error: String(err) });
    }
  }, []);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session: s } }) => {
        setSession(s);
        if (s?.access_token) return fetchProfile(s.access_token);
        return undefined;
      })
      .finally(() => setLoading(false));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      Sentry.setUser(s?.user ? { id: s.user.id } : null);
      if (event === 'SIGNED_IN' && s?.access_token) fetchProfile(s.access_token);
      if (event === 'SIGNED_OUT') setProfile(null);
    });
    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    await storage.clearUserData();
    setSession(null);
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.access_token) await fetchProfile(session.access_token);
  }, [session, fetchProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      isAdmin: profile?.role === 'admin',
      isVerifiedHost: !!profile?.identity_verified || profile?.role === 'verified' || profile?.role === 'admin',
      signOut,
      refreshProfile,
    }),
    [session, profile, loading, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
