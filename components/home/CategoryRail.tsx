import React from 'react';
import { FlatList, View, type ListRenderItemInfo } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import type { Event, FriendsGoing } from '../../lib/types';
import { EventCard } from '../EventCard';
import { EventCardSkeleton, SectionHeader, SkeletonGroup } from '../ui';

const CARD_W = 240;

function Gap() {
  return <View style={{ width: 14 }} />;
}

interface CategoryRailProps {
  title: string;
  events: Event[];
  friends: Record<string, FriendsGoing>;
  onSeeAll?: () => void;
}

export function CategoryRail({ title, events, friends, onSeeAll }: CategoryRailProps) {
  const t = useTheme();
  return (
    <View>
      <SectionHeader title={title} actionLabel={onSeeAll ? 'See all' : undefined} onAction={onSeeAll} />
      <FlatList
        data={events}
        horizontal
        keyExtractor={e => e.id}
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_W + 14}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: t.space.md, paddingVertical: 4 }}
        ItemSeparatorComponent={Gap}
        initialNumToRender={3}
        renderItem={({ item }: ListRenderItemInfo<Event>) => (
          <EventCard event={item} variant="carousel" width={CARD_W} friends={friends[item.id]} />
        )}
      />
    </View>
  );
}

export function RailSkeleton() {
  const t = useTheme();
  return (
    <SkeletonGroup label="Loading events">
      <View style={{ flexDirection: 'row', gap: 14, paddingHorizontal: t.space.md, overflow: 'hidden' }}>
        <EventCardSkeleton />
        <EventCardSkeleton />
      </View>
    </SkeletonGroup>
  );
}
