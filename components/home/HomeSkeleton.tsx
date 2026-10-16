import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { Skeleton, SkeletonGroup } from '../ui';
import { RailSkeleton } from './CategoryRail';

export function WeekStripSkeleton() {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: t.space.md }}>
      {Array.from({ length: 7 }, (_, i) => (
        <Skeleton key={i} height={64} radius={t.radius.md} style={{ flex: 1 }} width="auto" />
      ))}
    </View>
  );
}

export function EventsSkeleton() {
  const t = useTheme();
  return (
    <SkeletonGroup label="Loading events">
      <View style={{ gap: t.space.xl }}>
        {[0, 1].map(i => (
          <View key={i} style={{ gap: 12 }}>
            <Skeleton width={180} height={20} style={{ marginLeft: t.space.md }} />
            <RailSkeleton />
          </View>
        ))}
      </View>
    </SkeletonGroup>
  );
}
