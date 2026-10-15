import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { shadow } from '../../lib/theme';
import { AppText } from '../ui/AppText';
import { Glass } from '../ui/Glass';

export const ACTION_BAR_HEIGHT = 76;

/** Frosted sticky footer: summary on the left, actions on the right. */
export function EventActionBar({ title, caption, captionTone = 'muted', children }: { title: string; caption?: string; captionTone?: 'muted' | 'gold'; children: React.ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, shadow(3, t.c.shadow)]} pointerEvents="box-none">
      <Glass intensity={70} style={[styles.bar, { borderTopColor: t.c.borderStrong, paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText variant="title3" numberOfLines={1}>
            {title}
          </AppText>
          {caption ? (
            <AppText variant="caption" tone={captionTone} numberOfLines={1}>
              {caption}
            </AppText>
          ) : null}
        </View>
        <View style={styles.actions}>{children}</View>
      </Glass>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
