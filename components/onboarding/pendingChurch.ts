import AsyncStorage from '@react-native-async-storage/async-storage';
import { createChurch, updateSettings } from '../../lib/features';
import type { NewChurchDraft } from '../church/AddChurchSheet';
import { withCoordinates } from '../church/geocode';
import { logger } from '../../lib/logger';

/** A guest's Home Church choice from onboarding, applied to their settings after they sign in. */
export const PENDING_HOME_CHURCH_KEY = 'cl.pendingHomeChurch';
/** A church a guest added in onboarding; created (and made their Home Church) after they sign in. */
export const PENDING_NEW_CHURCH_KEY = 'cl.pendingNewChurch';
/** Stand-in id for that not-yet-created church while onboarding shows it as selected. */
export const PENDING_NEW_CHURCH_ID = 'pending-new-church';

/** Creates the church from the add form (geocoded when there's an address). */
export async function createChurchFromDraft(d: NewChurchDraft) {
  return createChurch(
    await withCoordinates({
      name: d.name,
      city: d.city,
      state: d.state || null,
      address: d.address || null,
      denomination: d.denomination || null,
      as_member: !d.leads,
    }),
  );
}

export async function setPendingNewChurch(draft: NewChurchDraft | null): Promise<void> {
  try {
    if (draft) await AsyncStorage.setItem(PENDING_NEW_CHURCH_KEY, JSON.stringify(draft));
    else await AsyncStorage.removeItem(PENDING_NEW_CHURCH_KEY);
  } catch (err) {
    logger.warn('Pending new church not stored', { error: String(err) });
  }
}

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
    const draft = await AsyncStorage.getItem(PENDING_NEW_CHURCH_KEY);
    if (draft) {
      const church = await createChurchFromDraft(JSON.parse(draft) as NewChurchDraft);
      await updateSettings({ home_church_id: church.id });
      await AsyncStorage.multiRemove([PENDING_NEW_CHURCH_KEY, PENDING_HOME_CHURCH_KEY]);
      return true;
    }
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
