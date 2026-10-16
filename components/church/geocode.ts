import * as Location from 'expo-location';
import { logger } from '../../lib/logger';
import type { Church } from '../../lib/types';

/** Best-effort lat/lng for the map; saving never fails because geocoding did. */
export async function withCoordinates<T extends Partial<Church>>(patch: T): Promise<T> {
  const query = [patch.address, patch.city, patch.state, patch.zip].filter(Boolean).join(', ');
  if (!query || (!patch.city && !patch.zip)) return patch;
  try {
    const [hit] = await Location.geocodeAsync(query);
    if (hit) return { ...patch, lat: hit.latitude, lng: hit.longitude };
  } catch (err) {
    logger.warn('Church geocode skipped', { error: String(err) });
  }
  return patch;
}
