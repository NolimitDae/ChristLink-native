import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
import { shadow } from '../../lib/theme';

interface CardProps {
  children: React.ReactNode;
  variant?: 'standard' | 'featured' | 'outline';
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  accessibilityLabel?: string;
}

export function Card({ children, variant = 'standard', onPress, onLongPress, style, padded = true, accessibilityLabel }: CardProps) {
  const t = useTheme();
  const base: ViewStyle = {
    backgroundColor: variant === 'outline' ? 'transparent' : t.c.surface,
    borderRadius: t.radius.lg,
    borderWidth: 1,
    borderColor: variant === 'featured' ? t.c.goldHairline : t.c.border,
    padding: padded ? t.space.md : 0,
    overflow: 'hidden',
    ...(variant === 'featured' ? shadow(2, t.c.shadow) : t.scheme === 'light' ? shadow(1, t.c.shadow) : null),
  };
  const content = (
    <>
      {variant === 'featured' ? (
        <LinearGradient
          colors={[t.c.goldDim, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}
      {children}
    </>
  );
  if (!onPress && !onLongPress) {
    return (
      <View style={[base, style]} accessible={!!accessibilityLabel} accessibilityLabel={accessibilityLabel}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [base, { opacity: pressed ? 0.85 : 1 }, style]}
    >
      {content}
    </Pressable>
  );
}

/** Ticket-shaped card with half-circle notches cut at the perforation line. */
export function TicketShell({
  top,
  bottom,
  notchAt,
  style,
  onPress,
  accessibilityLabel,
}: {
  top: React.ReactNode;
  bottom: React.ReactNode;
  /** Fraction of a fixed-height card above the perforation; omit to size both halves to their content. */
  notchAt?: number;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const t = useTheme();
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      style={[
        {
          backgroundColor: t.c.surface,
          borderRadius: t.radius.lg,
          borderWidth: 1,
          borderColor: t.c.goldHairline,
          ...shadow(2, t.c.shadow),
        },
        style,
      ]}
    >
      <View style={notchAt !== undefined ? { flex: notchAt } : undefined}>{top}</View>
      <TicketPerforation />
      <View style={notchAt !== undefined ? { flex: 1 - notchAt } : undefined}>{bottom}</View>
    </Wrapper>
  );
}

/**
 * The perforation line of a ticket: half-circle cutouts on both edges and a dashed line between them.
 * Place it as a direct child of a card with a 1px border; each cutout overlaps that border so the card edge
 * reads as notched (no clipping needed, so the card keeps its shadow).
 */
export function TicketPerforation({ size = 22 }: { size?: number }) {
  const t = useTheme();
  const r = size / 2;
  const cut = { width: r + 1, height: size, backgroundColor: t.c.bg, borderColor: t.c.goldHairline, borderWidth: 1 };
  return (
    <View style={[styles.perfRow, { height: size }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[cut, { marginLeft: -1, borderLeftWidth: 0, borderTopRightRadius: r, borderBottomRightRadius: r }]} />
      <View style={[styles.dash, { borderColor: t.c.border }]} />
      <View style={[cut, { marginRight: -1, borderRightWidth: 0, borderTopLeftRadius: r, borderBottomLeftRadius: r }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  perfRow: { flexDirection: 'row', alignItems: 'center' },
  dash: { flex: 1, borderTopWidth: 1.5, borderStyle: 'dashed', marginHorizontal: 8 },
});
