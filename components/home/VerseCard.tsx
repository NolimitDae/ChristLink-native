import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import type { Verse } from '../../lib/verses';
import { AppText, Button, Card, Skeleton } from '../ui';
import { AppIcon } from '../icons/AppIcon';

interface VerseCardProps {
  verse: Verse | null;
  theme?: string | null;
  onShare: (v: Verse) => void;
}

export function VerseCard({ verse, theme, onShare }: VerseCardProps) {
  const t = useTheme();
  return (
    <Card variant="featured" style={{ gap: t.space.sm }}>
      <View style={styles.eyebrow}>
        <AppIcon name="bible-outline" size={15} color={t.c.goldText} />
        <AppText variant="overline" tone="gold" numberOfLines={1} style={{ flexShrink: 1 }}>
          {theme ? `Verse of the day · for your ${theme.toLowerCase()} gathering` : 'Verse of the day'}
        </AppText>
      </View>
      {verse ? (
        <>
          <AppText variant="title3" style={{ lineHeight: 29 }} accessibilityRole="text">
            “{verse.text}”
          </AppText>
          <View style={styles.footer}>
            <AppText variant="callout" tone="gold" style={{ flex: 1 }}>
              {verse.reference}
              <AppText variant="caption" tone="faint">
                {'  '}
                {verse.translation}
              </AppText>
            </AppText>
            <Button title="Share" variant="ghost" size="sm" icon="share-outline" onPress={() => onShare(verse)} />
          </View>
        </>
      ) : (
        <View style={{ gap: 10 }} accessibilityLabel="Loading verse" accessible>
          <Skeleton height={18} />
          <Skeleton width="80%" height={18} />
          <Skeleton width="35%" height={12} style={{ marginTop: 6 }} />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
