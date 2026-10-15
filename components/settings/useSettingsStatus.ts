import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useAppData } from '../../contexts/AppDataContext';
import { FeatureError, getSettings } from '../../lib/features';

export type SettingsStatus = 'loading' | 'ready' | 'unavailable' | 'signedOut';

/**
 * AppData's `settings` is null both when the row doesn't exist yet and when the table isn't deployed,
 * so probe once to tell them apart.
 */
export function useSettingsStatus(): { status: SettingsStatus; retry: () => void } {
  const { session } = useAuth();
  const { setSettings } = useAppData();
  const [status, setStatus] = useState<SettingsStatus>(session ? 'loading' : 'signedOut');

  const probe = useCallback(async () => {
    if (!session) {
      setStatus('signedOut');
      return;
    }
    try {
      const s = await getSettings();
      if (s) setSettings(s);
      setStatus('ready');
    } catch (err) {
      setStatus(err instanceof FeatureError && err.notSetUp ? 'unavailable' : 'ready');
    }
  }, [session, setSettings]);

  useEffect(() => {
    probe();
  }, [probe]);

  return { status, retry: probe };
}
