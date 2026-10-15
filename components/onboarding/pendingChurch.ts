import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateSettings } from '../../lib/features';
import { logger } from '../../lib/logger';

/** A guest's Home Church choice from onboarding, applied to their settings after they sign in. */
export const PENDING_HOME_CHURCH_KEY = 'cl.pendingHomeChurch';

export async function setPendingHomeChurch(churchId: string | null): Promise<void> {
  try {
    if (churchId) await AsyncStorage.setItem(PENDING_HOME_CHURCH_KEY, churchId);
    else await AsyncStorage.removeItem(PENDING_HOME_CHURCH_KEY);
  } catch (err) {
    logger.warn('Pending home church not stored', { error: String(err) });
  }
}

/** Returns true if a pending church was applied. */
export async function applyPendingHomeChurch(): Promise<boolean> {
  try {
    const id = await AsyncStorage.getItem(PENDING_HOME_CHURCH_KEY);
    if (!id) return false;
    await updateSettings({ home_church_id: id });
    await AsyncStorage.removeItem(PENDING_HOME_CHURCH_KEY);
    return true;
  } catch (err) {
    logger.warn('Pending home church not applied', { error: String(err) });
    return false;
  }
}
