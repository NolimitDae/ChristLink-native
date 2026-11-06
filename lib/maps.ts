import { Linking, Platform } from 'react-native';

export interface Place {
  parts: (string | null | undefined)[];
  lat?: number | null;
  lng?: number | null;
}

export function mapsUrl(place: Place, opts: { directions?: boolean; os?: string } = {}): string {
  const os = opts.os ?? Platform.OS;
  const q = encodeURIComponent(place.parts.filter(Boolean).join(', '));
  const hasCoords = typeof place.lat === 'number' && typeof place.lng === 'number';
  if (os === 'ios') {
    if (opts.directions) return `http://maps.apple.com/?daddr=${hasCoords ? `${place.lat},${place.lng}` : q}`;
    return `http://maps.apple.com/?q=${q}${hasCoords ? `&ll=${place.lat},${place.lng}` : ''}`;
  }
  if (os === 'android') {
    if (opts.directions) return `google.navigation:q=${hasCoords ? `${place.lat},${place.lng}` : q}`;
    return `geo:${hasCoords ? `${place.lat},${place.lng}` : '0,0'}?q=${q}`;
  }
  const dest = hasCoords ? `${place.lat},${place.lng}` : q;
  return opts.directions
    ? `https://www.google.com/maps/dir/?api=1&destination=${dest}`
    : `https://www.google.com/maps/search/?api=1&query=${dest}`;
}

/** Opens the platform maps app; falls back to Google Maps on the web if the app link can't open. */
export async function openInMaps(place: Place, opts: { directions?: boolean } = {}): Promise<void> {
  try {
    await Linking.openURL(mapsUrl(place, opts));
  } catch {
    await Linking.openURL(mapsUrl(place, { ...opts, os: 'web' }));
  }
}
