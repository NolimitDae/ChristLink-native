import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { streakLabel } from '../../lib/streak';
import type { Verse } from '../../lib/verses';
import { AppText, Button, Card, Skeleton } from '../ui';
import { AppIcon } from '../icons/AppIcon';
import type { DevotionStreak } from './useDevotionStreak';

interface VerseCardProps {
  verse: Verse | null;
  theme?: string | null;
  onShare: (v: Verse) => void;
  streak?: DevotionStreak | null;
}

export function VerseCard({ verse, theme, onShare, streak }: VerseCardProps) {
  const t = useTheme();
  return (
    <Card variant="featured" style={{ gap: t.space.sm }}>
      <View style={styles.eyebrow}>
        <AppIcon name="bible-outline" size={15} color={t.c.goldText} />
        <AppText variant="label" tone="gold" numberOfLines={1} style={{ flexShrink: 1 }}>
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
          {streak ? <StreakRow streak={streak} /> : null}
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

function StreakRow({ streak }: { streak: DevotionStreak }) {
  const t = useTheme();
  const count = streak.dots.filter(d => d.done).length;
  const label = streakLabel(streak.streak, count);
  return (
    <View
      style={[styles.streak, { borderTopColor: t.c.goldHairline }]}
      accessible
      accessibilityLabel={`${label}. ${count} of 7 days this week.`}
    >
      <View style={styles.dots}>
        {streak.dots.map(d => (
          <View key={d.key} style={styles.dotCol}>
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: d.done ? t.c.gold : 'transparent',
                  borderColor: d.done ? t.c.gold : d.isToday ? t.c.goldText : t.c.border,
                },
              ]}
            />
            <AppText variant="caption" tone={d.isToday ? 'gold' : 'faint'} style={{ fontSize: 9, lineHeight: 11 }}>
              {d.label}
            </AppText>
          </View>
        ))}
      </View>
      <AppText variant="caption" tone="muted" numberOfLines={1} style={{ flex: 1, textAlign: 'right' }}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  streak: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  dots: { flexDirection: 'row', gap: 6 },
  dotCol: { alignItems: 'center', gap: 3 },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5 },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
