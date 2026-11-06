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

/** Serif section title. Hierarchy comes from type and spacing; an optional action sits at the right edge. */
export function SectionHeader({ title, eyebrow, actionLabel, onAction, style }: SectionHeaderProps) {
  const t = useTheme();
  return (
    <View style={[styles.wrap, { paddingHorizontal: t.space.md }, style]}>
      {eyebrow ? (
        <AppText variant="label" tone="muted" style={{ marginBottom: 2 }}>
          {eyebrow}
        </AppText>
      ) : null}
      <View style={styles.row}>
        <AppText variant="title2" numberOfLines={1} style={{ flex: 1 }}>
          {title}
        </AppText>
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
});
