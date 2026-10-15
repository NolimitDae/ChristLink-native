import React, { useCallback, useRef, useState } from 'react';
import { Linking, View } from 'react-native';
import * as Location from 'expo-location';
import { useToast } from '../../contexts/ToastContext';
import { logger } from '../../lib/logger';
import { AppText, BottomSheet, Button, LineArt } from '../ui';

export interface Coords {
  lat: number;
  lng: number;
}

async function currentCoords(): Promise<Coords | null> {
  try {
    const last = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000 });
    const pos = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch (err) {
    logger.warn('Location unavailable', { error: String(err) });
    return null;
  }
}

/** Already-granted permission only; never prompts. */
export async function silentLocation(): Promise<Coords | null> {
  try {
    const perm = await Location.getForegroundPermissionsAsync();
    return perm.granted ? await currentCoords() : null;
  } catch {
    return null;
  }
}

/**
 * Foreground location with a pre-prompt that explains why before the system dialog appears.
 * Render `sheet` once in the screen.
 */
export function useUserLocation(reason: string) {
  const { showToast } = useToast();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const resolver = useRef<((c: Coords | null) => void) | null>(null);

  const settle = useCallback((c: Coords | null) => {
    resolver.current?.(c);
    resolver.current = null;
  }, []);

  const request = useCallback(async (): Promise<Coords | null> => {
    const perm = await Location.getForegroundPermissionsAsync();
    if (perm.granted) {
      const c = await currentCoords();
      if (!c) showToast('We couldn’t find your location. Try again in a moment.', 'error');
      return c;
    }
    if (!perm.canAskAgain) {
      showToast('Location is turned off for Christ Link. You can enable it in Settings.', 'info');
      return null;
    }
    return new Promise<Coords | null>(resolve => {
      resolver.current = resolve;
      setVisible(true);
    });
  }, [showToast]);

  const allow = useCallback(async () => {
    setBusy(true);
    try {
      const res = await Location.requestForegroundPermissionsAsync();
      setVisible(false);
      if (!res.granted) {
        showToast('No problem — you can still search by city or name.', 'info');
        settle(null);
        return;
      }
      const c = await currentCoords();
      if (!c) showToast('We couldn’t find your location. Try again in a moment.', 'error');
      settle(c);
    } finally {
      setBusy(false);
    }
  }, [settle, showToast]);

  const dismiss = useCallback(() => {
    setVisible(false);
    settle(null);
  }, [settle]);

  const sheet = (
    <BottomSheet
      visible={visible}
      onClose={dismiss}
      title="Find gatherings near you"
      footer={
        <View style={{ gap: 8 }}>
          <Button title="Allow location" icon="navigate" fullWidth onPress={allow} loading={busy} />
          <Button title="Not now" variant="ghost" fullWidth onPress={dismiss} />
        </View>
      }
    >
      <View style={{ alignItems: 'center', gap: 12, paddingVertical: 8 }}>
        <LineArt name="map" size={88} />
        <AppText variant="body" tone="muted" align="center">
          {reason}
        </AppText>
        <AppText variant="caption" tone="faint" align="center">
          We only use your location while the app is open, and never share it with hosts.
        </AppText>
      </View>
    </BottomSheet>
  );

  return { request, sheet, openSettings: () => Linking.openSettings() };
}
