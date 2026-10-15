import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { AppText } from './AppText';

interface SectionHeaderProps {
  title: string;
  eyebrow?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Serif section title with the gold hairline rule. */
export function SectionHeader({ title, eyebrow, actionLabel, onAction, style }: SectionHeaderProps) {
  const t = useTheme();
  return (
    <View style={[styles.wrap, { paddingHorizontal: t.space.md }, style]}>
      {eyebrow ? (
        <AppText variant="overline" tone="gold" style={{ marginBottom: 2 }}>
          {eyebrow}
        </AppText>
      ) : null}
      <View style={styles.row}>
        <AppText variant="title3" numberOfLines={1} style={{ flexShrink: 1 }}>
          {title}
        </AppText>
        <View style={[styles.hairline, { backgroundColor: t.c.goldHairline }]} />
        {actionLabel && onAction ? (
          <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button" accessibilityLabel={`${actionLabel}: ${title}`}>
            <AppText variant="caption" tone="gold">
              {actionLabel}
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hairline: { flex: 1, height: StyleSheet.hairlineWidth * 2, opacity: 0.9 },
});
