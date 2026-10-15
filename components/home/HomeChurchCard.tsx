import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { getChurch, getChurchRecurring } from '../../lib/features';
import { formatDateShort, formatTime } from '../../lib/format';
import { logger } from '../../lib/logger';
import type { Church, ChurchRecurringEvent, Event } from '../../lib/types';
import { AppText, Button, Card, DateBlock, LineArt, Skeleton } from '../ui';
import { ChurchLogo, VerifiedMark } from '../church/ChurchRow';
import { churchPlace, isNotSetUp, shortDay, upcomingSchedule } from '../church/churchFormat';

interface HomeChurchCardProps {
  churchId: string | null;
  nextEvent: Event | null;
  refreshKey: number;
}

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; church: Church; recurring: ChurchRecurringEvent[] }
  | { kind: 'none' };

export function HomeChurchCard({ churchId, nextEvent, refreshKey }: HomeChurchCardProps) {
  const t = useTheme();
  const router = useRouter();
  const [state, setState] = useState<State>(churchId ? { kind: 'loading' } : { kind: 'none' });

  useEffect(() => {
    let cancelled = false;
    if (!churchId) {
      setState({ kind: 'none' });
      return;
    }
    setState(s => (s.kind === 'ready' && s.church.id === churchId ? s : { kind: 'loading' }));
    Promise.all([getChurch(churchId), getChurchRecurring(churchId).catch(() => [] as ChurchRecurringEvent[])])
      .then(([church, recurring]) => {
        if (cancelled) return;
        setState(church ? { kind: 'ready', church, recurring } : { kind: 'none' });
      })
      .catch(err => {
        if (!isNotSetUp(err)) logger.warn('Home church not loaded', { error: String(err) });
        if (!cancelled) setState({ kind: 'none' });
      });
    return () => {
      cancelled = true;
    };
  }, [churchId, refreshKey]);

  if (state.kind === 'loading') {
    return (
      <Card style={{ gap: 12 }}>
        <View style={styles.head}>
          <Skeleton width={48} height={48} radius={14} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width="30%" height={10} />
            <Skeleton width="65%" height={16} />
          </View>
        </View>
        <Skeleton height={36} radius={10} />
      </Card>
    );
  }

  if (state.kind === 'none') {
    return (
      <Card onPress={() => router.push('/explore?tab=churches')} accessibilityLabel="Find your Home Church" style={styles.placeholder}>
        <LineArt name="church" size={64} />
        <View style={{ flex: 1, gap: 4 }}>
          <AppText variant="title3">Find your Home Church</AppText>
          <AppText variant="callout" tone="muted">
            See service times, gatherings and church events right here every week.
          </AppText>
          <AppText variant="caption" tone="gold" style={{ marginTop: 4 }}>
            Browse churches →
          </AppText>
        </View>
      </Card>
    );
  }

  const { church, recurring } = state;
  const week = upcomingSchedule(church, recurring, 7).slice(0, 4);
  const place = churchPlace(church);

  return (
    <Card onPress={() => router.push(`/church/${church.id}`)} accessibilityLabel={`Your Home Church, ${church.name}`} style={{ gap: t.space.sm }}>
      <View style={styles.head}>
        <ChurchLogo church={church} />
        <View style={{ flex: 1 }}>
          <AppText variant="overline" tone="gold">
            Your Home Church
          </AppText>
          <View style={styles.nameRow}>
            <AppText variant="title3" numberOfLines={1} style={{ flexShrink: 1 }}>
              {church.name}
            </AppText>
            {church.verified ? <VerifiedMark /> : null}
          </View>
          {place ? (
            <AppText variant="caption" tone="muted" numberOfLines={1}>
              {place}
            </AppText>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color={t.c.textFaint} />
      </View>

      {week.length > 0 ? (
        <View style={{ gap: 6 }}>
          <AppText variant="caption" tone="muted">
            This week
          </AppText>
          <View style={styles.chips}>
            {week.map(item => (
              <View
                key={item.key}
                style={[
                  styles.chip,
                  {
                    backgroundColor: item.isService ? t.c.goldDim : t.c.surface2,
                    borderColor: item.isService ? t.c.goldHairline : t.c.border,
                    borderRadius: t.radius.sm,
                  },
                ]}
              >
                <AppText variant="caption" tone={item.isService ? 'gold' : 'muted'}>
                  {shortDay(item.date)} {formatTime(item.date.toISOString())}
                </AppText>
                <AppText variant="caption" numberOfLines={1}>
                  {item.title}
                </AppText>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {nextEvent ? (
        <View style={[styles.next, { borderTopColor: t.c.border }]}>
          <DateBlock iso={nextEvent.start_date} size="sm" />
          <View style={{ flex: 1 }}>
            <AppText variant="caption" tone="muted">
              Next event · {formatDateShort(nextEvent.start_date)}
            </AppText>
            <AppText variant="bodyStrong" numberOfLines={1}>
              {nextEvent.name}
            </AppText>
          </View>
          <Button title="View" size="sm" variant="secondary" onPress={() => router.push(`/event/${nextEvent.id}`)} />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  placeholder: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, maxWidth: '100%', gap: 1 },
  next: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
