import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { getAppConfig, type AppConfig } from './api';
import { logger } from './logger';

/**
 * Optional features the server has switched on (GET /api/app-config). Read once per app launch; until it arrives
 * (or if it fails) everything optional counts as off, so the app never shows a button that would only fail.
 */
let cached: AppConfig | null = null;
let pending: Promise<AppConfig | null> | null = null;

export function loadAppConfig(): Promise<AppConfig | null> {
  if (cached) return Promise.resolve(cached);
  pending ??= getAppConfig()
    .then(c => (cached = c))
    .catch(err => {
      logger.warn('App config not loaded', { error: String(err) });
      pending = null;
      return null;
    });
  return pending;
}

export function useAppConfig(): AppConfig | null {
  const [config, setConfig] = useState<AppConfig | null>(cached);
  useEffect(() => {
    if (cached) return;
    let alive = true;
    loadAppConfig().then(c => alive && setConfig(c));
    return () => {
      alive = false;
    };
  }, []);
  return config;
}

/** Whether "Add to Apple Wallet" / "Add to Google Wallet" can work on this device. */
export function walletAvailable(config: AppConfig | null): boolean {
  if (!config) return false;
  if (Platform.OS === 'ios') return config.apple_wallet;
  if (Platform.OS === 'android') return config.google_wallet;
  return false;
}

/** Test helper. */
export function resetAppConfigCache() {
  cached = null;
  pending = null;
}
