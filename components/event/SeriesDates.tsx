import React from 'react';
import { ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { isRepeatRule, repeatEndLabel, repeatSentence } from '../../lib/eventRepeat';
import type { Event } from '../../lib/types';
import { AppText, Card, Chip } from '../ui';

/**
 * On a repeating event's page: how often it happens and its next dates. Each date is its own event (own RSVPs and
 * reminders), so tapping one opens that date.
 */
export function SeriesDates({ event, onOpen }: { event: Event; onOpen: (id: string) => void }) {
  const t = useTheme();
  const series = event.series;
  if (!series || !isRepeatRule(series.rule) || !event.start_date) return null;
  const dates = series.dates;
  const sentence = repeatSentence(series.rule, new Date(event.start_date));
  const sub = series.ended ? 'No longer repeating' : repeatEndLabel(series.until);

  return (
    <Card style={{ gap: t.space.sm }}>
      <View style={{ flexDirection: 'row', gap: t.space.sm, alignItems: 'flex-start' }}>
        <Ionicons name="repeat-outline" size={22} color={t.c.goldText} style={{ marginTop: 1 }} />
        <View style={{ flex: 1 }}>
          <AppText variant="bodyStrong">{sentence}</AppText>
          <AppText variant="callout" tone="muted">
            {sub}. Each date has its own RSVPs.
          </AppText>
        </View>
      </View>
      {dates.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: t.space.xs, paddingRight: t.space.xs }}
          accessibilityLabel="Other dates"
        >
          {dates.map(d => {
            const day = new Date(d.start_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            const cancelled = d.status === 'cancelled';
            return (
              <Chip
                key={d.id}
                label={cancelled ? `${day} · Cancelled` : day}
                selected={d.id === event.id}
                onPress={d.id === event.id ? undefined : () => onOpen(d.id)}
              />
            );
          })}
        </ScrollView>
      ) : null}
    </Card>
  );
}
