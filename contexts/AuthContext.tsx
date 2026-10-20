import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { getProfile, requestSignInCode, revokeRefreshToken, verifySignInCode } from '../lib/api';
import { deletePushToken } from '../lib/features';
import { currentPushToken } from '../lib/notifications';
import { getSession, loadSession, onSessionChange, refreshSession, sessionFromTokens, setSession, type StoredSession } from '../lib/session';
import { storage } from '../lib/storage';
import { logger } from '../lib/logger';
import type { Profile } from '../lib/types';

export interface AuthUser {
  id: string;
  email: string;
}

/** Same field names screens used with the old session object. */
export interface AuthSession {
  access_token: string;
  user: AuthUser;
}

interface AuthContextValue {
  session: AuthSession | null;
  user: AuthUser | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  isVerifiedHost: boolean;
  /** Emails a 6-digit code; a name creates the account with it. Throws ApiError with a readable message. */
  signIn: (email: string, fullName?: string) => Promise<void>;
  /** Exchanges the code for tokens and signs in. Throws ApiError when the code is wrong or expired. */
  verifyOtp: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const toAuthSession = (s: StoredSession | null): AuthSession | null => (s ? { access_token: s.accessToken, user: s.user } : null);

// Refresh on foreground only when the token is close to expiring, so app switching doesn't rotate tokens constantly.
const FOREGROUND_REFRESH_MS = 5 * 60_000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setAuthSession] = useState<AuthSession | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!getSession()) return;
    try {
      setProfile(await getProfile(getSession()?.accessToken ?? ''));
    } catch (err) {
      logger.warn('Profile not loaded', { error: String(err) });
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onSessionChange(s => {
      setAuthSession(prev => (prev?.access_token === s?.accessToken ? prev : toAuthSession(s)));
      Sentry.setUser(s ? { id: s.user.id } : null);
      if (!s) setProfile(null);
    });
    loadSession()
      .then(s => {
        setAuthSession(toAuthSession(s));
        Sentry.setUser(s ? { id: s.user.id } : null);
        return s ? fetchProfile() : undefined;
      })
      .finally(() => setLoading(false));

    const sub = AppState.addEventListener('change', state => {
      const s = getSession();
      if (state === 'active' && s && s.expiresAt - Date.now() < FOREGROUND_REFRESH_MS) refreshSession();
    });
    return () => {
      unsubscribe();
      sub.remove();
    };
  }, [fetchProfile]);

  const signIn = useCallback(async (email: string, fullName?: string) => {
    await requestSignInCode(email, fullName);
  }, []);

  const verifyOtp = useCallback(async (email: string, code: string) => {
    const res = await verifySignInCode(email, code);
    await setSession(sessionFromTokens(res, { id: res.user.id, email: res.user.email }));
    if (res.user.profile) setProfile(res.user.profile);
    else await fetchProfile();
  }, [fetchProfile]);

  const signOut = useCallback(async () => {
    if (getSession()) {
      // Detach this phone's push token first (needs auth), then revoke the refresh token. Neither may block sign-out.
      try {
        const pushToken = await currentPushToken();
        if (pushToken) await deletePushToken(pushToken);
      } catch (err) {
        logger.warn('Push token not removed', { error: String(err) });
      }
      // Read after the call above: it may have rotated the refresh token.
      const refreshToken = getSession()?.refreshToken;
      if (refreshToken) await revokeRefreshToken(refreshToken).catch(err => logger.warn('Sign-out not sent', { error: String(err) }));
    }
    await setSession(null);
    await storage.clearUserData().catch(err => logger.warn('Local data not cleared', { error: String(err) }));
    setAuthSession(null);
    setProfile(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      isAdmin: profile?.role === 'admin',
      isVerifiedHost: !!profile?.identity_verified || profile?.role === 'verified' || profile?.role === 'admin',
      signIn,
      verifyOtp,
      signOut,
      refreshProfile: fetchProfile,
    }),
    [session, profile, loading, signIn, verifyOtp, signOut, fetchProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
