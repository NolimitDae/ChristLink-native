import React, { useRef } from 'react';
import { Animated, View, type ListRenderItemInfo } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import type { Event, FriendsGoing } from '../../lib/types';
import { EventCard } from '../EventCard';
import { SectionHeader } from '../ui';

const CARD_W = 280;
const GAP = 14;
const SNAP = CARD_W + GAP;
const PARALLAX = 18;

function Separator() {
  return <View style={{ width: GAP }} />;
}

function ParallaxItem({
  index,
  scrollX,
  enabled,
  children,
}: {
  index: number;
  scrollX: Animated.Value;
  enabled: boolean;
  children: React.ReactNode;
}) {
  if (!enabled) return <View style={{ width: CARD_W }}>{children}</View>;
  const inputRange = [(index - 1) * SNAP, index * SNAP, (index + 1) * SNAP];
  const translateX = scrollX.interpolate({ inputRange, outputRange: [-PARALLAX, 0, PARALLAX], extrapolate: 'clamp' });
  const scale = scrollX.interpolate({ inputRange, outputRange: [0.95, 1, 0.95], extrapolate: 'clamp' });
  return <Animated.View style={{ width: CARD_W, transform: [{ translateX }, { scale }] }}>{children}</Animated.View>;
}

interface TonightCarouselProps {
  title: string;
  eyebrow?: string;
  events: Event[];
  friends: Record<string, FriendsGoing>;
}

export function TonightCarousel({ title, eyebrow, events, friends }: TonightCarouselProps) {
  const t = useTheme();
  const scrollX = useRef(new Animated.Value(0)).current;
  const parallax = !t.reduceMotion;

  return (
    <View>
      <SectionHeader title={title} eyebrow={eyebrow} />
      <Animated.FlatList
        data={events}
        horizontal
        keyExtractor={(e: Event) => e.id}
        showsHorizontalScrollIndicator={false}
        snapToInterval={SNAP}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: t.space.md, paddingVertical: 4 }}
        ItemSeparatorComponent={Separator}
        scrollEventThrottle={16}
        onScroll={parallax ? Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true }) : undefined}
        renderItem={({ item, index }: ListRenderItemInfo<Event>) => (
          <ParallaxItem index={index} scrollX={scrollX} enabled={parallax}>
            <EventCard event={item} variant="carousel" width={CARD_W} friends={friends[item.id]} />
          </ParallaxItem>
        )}
      />
    </View>
  );
}
