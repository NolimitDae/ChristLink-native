import React from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AVATAR_COLORS } from '../lib/constants';
import { gradientStops, readableOn, solidColor } from '../lib/color';

interface AvatarProps {
  uri?: string | null;
  name?: string | null;
  color?: string | null;
  size?: number;
  ringColor?: string | null;
  ringWidth?: number;
  style?: StyleProp<ViewStyle>;
}

function initials(name?: string | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

function defaultColor(name?: string | null): string {
  if (!name) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function Avatar({ uri, name, color, size = 40, ringColor, ringWidth = 2, style }: AvatarProps) {
  const fallback = defaultColor(name);
  const stops = gradientStops(color);
  const bg = solidColor(color, fallback);
  const label = initials(name);
  const fontSize = Math.max(10, Math.floor(size * (label.length > 1 ? 0.36 : 0.42)));

  const inner = uri ? (
    <Image
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      accessibilityIgnoresInvertColors
    />
  ) : (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>
      {stops ? (
        <LinearGradient colors={stops} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: bg }]} />
      )}
      <View style={styles.overlay}>
        <Text style={{ color: readableOn(stops ? stops[0] : bg), fontSize, fontWeight: '700' }}>{label}</Text>
      </View>
    </View>
  );

  const a11y = { accessible: true, accessibilityRole: 'image' as const, accessibilityLabel: name ? `${name}'s photo` : 'Profile photo' };

  if (!ringColor) return <View style={style} {...a11y}>{inner}</View>;
  const outer = size + ringWidth * 2 + 4;
  return (
    <View
      {...a11y}
      style={[
        styles.center,
        { width: outer, height: outer, borderRadius: outer / 2, borderWidth: ringWidth, borderColor: ringColor },
        style,
      ]}
    >
      {inner}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  overlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
});
