import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppData } from '../contexts/AppDataContext';
import { useTheme } from '../contexts/ThemeContext';
import { AppText } from './ui/AppText';

export function OfflineBanner() {
  const { online } = useAppData();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  if (online) return null;
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.bar, { top: insets.top + 4, backgroundColor: t.c.surface3, borderColor: t.c.goldHairline }]}
      pointerEvents="none"
    >
      <Ionicons name="cloud-offline-outline" size={16} color={t.c.goldText} />
      <AppText variant="caption">You’re offline. Saved tickets still work.</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 9000,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
});
