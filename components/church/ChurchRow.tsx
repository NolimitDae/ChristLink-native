import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import type { Church } from '../../lib/types';
import { AppText, Skeleton } from '../ui';
import { churchPlace } from './churchFormat';

export function ChurchLogo({ church, size = 48 }: { church: Pick<Church, 'name' | 'logo_url'>; size?: number }) {
  const t = useTheme();
  const radius = Math.round(size * 0.3);
  if (church.logo_url) {
    return (
      <Image
        source={{ uri: church.logo_url }}
        style={{ width: size, height: size, borderRadius: radius, backgroundColor: t.c.surface2 }}
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: t.c.goldDim,
        borderWidth: 1,
        borderColor: t.c.goldHairline,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <AppText variant={size >= 64 ? 'title1' : 'title3'} tone="gold">
        {(church.name.trim()[0] ?? '✝').toUpperCase()}
      </AppText>
    </View>
  );
}

export function VerifiedMark({ size = 16 }: { size?: number }) {
  const t = useTheme();
  return (
    <Ionicons
      name="checkmark-circle"
      size={size}
      color={t.c.goldText}
      accessibilityLabel="Verified church"
      accessibilityRole="image"
    />
  );
}

interface ChurchRowProps {
  church: Church;
  onPress: () => void;
  selected?: boolean;
}

export function ChurchRow({ church, onPress, selected }: ChurchRowProps) {
  const t = useTheme();
  const place = churchPlace(church);
  const sub = [church.denomination, place].filter(Boolean).join(' · ');
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${church.name}${church.verified ? ', verified' : ''}. ${sub}`}
      accessibilityState={{ selected: !!selected }}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: t.c.surface,
          borderColor: selected ? t.c.gold : t.c.border,
          borderRadius: t.radius.lg,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <ChurchLogo church={church} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.nameRow}>
          <AppText variant="headline" numberOfLines={1} style={{ flexShrink: 1 }}>
            {church.name}
          </AppText>
          {church.verified ? <VerifiedMark /> : null}
        </View>
        {sub ? (
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {sub}
          </AppText>
        ) : null}
      </View>
      <Ionicons name={selected ? 'checkmark' : 'chevron-forward'} size={18} color={selected ? t.c.goldText : t.c.textFaint} />
    </Pressable>
  );
}

export function ChurchRowSkeleton() {
  const t = useTheme();
  return (
    <View style={[styles.row, { backgroundColor: t.c.surface, borderColor: t.c.border, borderRadius: t.radius.lg }]}>
      <Skeleton width={48} height={48} radius={14} />
      <View style={{ flex: 1, gap: 8 }}>
        <Skeleton width="60%" height={14} />
        <Skeleton width="40%" height={10} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderWidth: 1, minHeight: 72 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
