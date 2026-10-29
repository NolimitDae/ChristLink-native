import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { makeStyles, useTheme } from '../../contexts/ThemeContext';
import { FeatureError, searchChurches } from '../../lib/features';
import type { Church } from '../../lib/types';
import { AppText, EmptyState, Field, LineArt, Skeleton } from '../ui';
import { AppIcon } from '../icons/AppIcon';

const DEBOUNCE_MS = 300;

export function ChurchStep({ selectedId, onSelect }: { selectedId: string | null; onSelect: (church: Church | null) => void }) {
  const t = useTheme();
  const s = useStyles();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Church[] | null>(null);
  const [notSetUp, setNotSetUp] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const id = setTimeout(async () => {
      try {
        const rows = await searchChurches(query, 12);
        if (!cancelled) {
          setResults(rows);
          setFailed(false);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof FeatureError && err.notSetUp) setNotSetUp(true);
        else setFailed(true);
        setResults([]);
      }
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [query]);

  if (notSetUp) {
    return (
      <View style={s.center}>
        <LineArt name="church" size={120} />
        <AppText variant="title2" align="center" style={{ marginTop: t.space.md }}>
          Find your Home Church
        </AppText>
        <AppText variant="body" tone="muted" align="center" style={{ marginTop: t.space.xs, maxWidth: 300 }}>
          You can choose a Home Church later from your profile. Tap Next to continue.
        </AppText>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, gap: t.space.sm }}>
      <AppText variant="title1">Find your Home Church</AppText>
      <AppText variant="body" tone="muted">
        See its services, prayers and serve opportunities first. You can change this anytime.
      </AppText>
      <Field
        value={query}
        onChangeText={setQuery}
        placeholder="Search by church name or city"
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel="Search churches"
        left={<Ionicons name="search" size={18} color={t.c.textFaint} style={{ alignSelf: 'center' }} />}
      />
      <View style={{ flex: 1, gap: t.space.xs }}>
        {results === null ? (
          <View style={{ gap: t.space.xs }} accessibilityLabel="Loading churches">
            <Skeleton height={56} radius={t.radius.md} />
            <Skeleton height={56} radius={t.radius.md} />
            <Skeleton height={56} radius={t.radius.md} />
          </View>
        ) : results.length === 0 ? (
          <EmptyState
            compact
            art="church"
            title={failed ? "Couldn't search churches" : 'No churches found'}
            body={failed ? 'Check your connection. You can choose later.' : 'Try another name or city. You can also choose later.'}
          />
        ) : (
          results.slice(0, 6).map(c => {
            const selected = c.id === selectedId;
            return (
              <Pressable
                key={c.id}
                onPress={() => onSelect(selected ? null : c)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${c.name}${c.city ? `, ${c.city}` : ''}`}
                style={({ pressed }) => [s.row, selected && s.rowSelected, { opacity: pressed ? 0.75 : 1 }]}
              >
                <View style={s.rowIcon}>
                  <AppIcon name="church-outline" size={18} color={t.c.goldText} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <AppText variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
                      {c.name}
                    </AppText>
                    {c.verified ? <Ionicons name="checkmark-circle" size={14} color={t.c.goldText} accessibilityLabel="Verified" /> : null}
                  </View>
                  <AppText variant="caption" tone="muted" numberOfLines={1}>
                    {[c.denomination, [c.city, c.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ') || 'Church'}
                  </AppText>
                </View>
                <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={22} color={selected ? t.c.gold : t.c.textFaint} />
              </Pressable>
            );
          })
        )}
      </View>
    </View>
  );
}

const useStyles = makeStyles(t => ({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.sm,
    minHeight: 60,
    paddingHorizontal: t.space.sm,
    borderRadius: t.radius.md,
    borderWidth: 1,
    borderColor: t.c.border,
    backgroundColor: t.c.surface,
  },
  rowSelected: { borderColor: t.c.gold, backgroundColor: t.c.goldDim },
  rowIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: t.c.goldDim },
}));
