import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { FeatureError, getChurchVisits, type ChurchVisit } from '../../lib/features';
import { logger } from '../../lib/logger';
import { Avatar } from '../Avatar';
import { AppText, Skeleton } from '../ui';
import { Section } from './ChurchSections';

function when(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}

/** Church owner view: people who used "Plan a visit" for an upcoming service. Hidden until someone has. */
export function PlannedVisits({ churchId, refreshKey }: { churchId: string; refreshKey?: number }) {
  const t = useTheme();
  const [visits, setVisits] = useState<ChurchVisit[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getChurchVisits(churchId)
      .then(v => {
        if (!cancelled) setVisits(v);
      })
      .catch(err => {
        if (!(err instanceof FeatureError && err.notSetUp)) logger.info('Planned visits unavailable', { error: String(err) });
        if (!cancelled) setVisits([]);
      });
    return () => {
      cancelled = true;
    };
  }, [churchId, refreshKey]);

  if (visits === null) {
    return (
      <Section title="Planned visits">
        <Skeleton height={64} radius={16} />
      </Section>
    );
  }
  if (visits.length === 0) return null;

  const people = visits.reduce((n, v) => n + v.party_size, 0);
  return (
    <Section title={`Planned visits · ${people}`}>
      <View style={{ gap: 8 }}>
        {visits.map(v => (
          <View key={v.id} style={[styles.row, { backgroundColor: t.c.surface, borderColor: t.c.border, borderRadius: t.radius.md }]}>
            <Avatar uri={v.visitor?.avatar_url} name={v.visitor?.full_name} color={v.visitor?.avatar_color} size={36} />
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="bodyStrong" numberOfLines={1}>
                {v.visitor?.full_name || 'A visitor'}
                {v.party_size > 1 ? ` + ${v.party_size - 1}` : ''}
              </AppText>
              <AppText variant="caption" tone="muted">
                {v.service_label ? `${v.service_label} · ` : ''}
                {when(v.visit_at)}
              </AppText>
              {v.note ? (
                <AppText variant="caption" numberOfLines={3}>
                  “{v.note}”
                </AppText>
              ) : null}
              {v.visitor?.email ? (
                <AppText variant="caption" tone="gold" selectable>
                  {v.visitor.email}
                </AppText>
              ) : null}
            </View>
          </View>
        ))}
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 12, borderWidth: 1 },
});
