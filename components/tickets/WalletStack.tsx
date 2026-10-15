import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { haptic } from '../../lib/haptics';
import { formatDateShort } from '../../lib/format';
import { WALLET_CARD_HEIGHT, WalletTicketCard } from './WalletTicketCard';
import type { WalletItem } from './walletItems';

const PEEK = 74;
const GAP = 14;
const LIFT = 10;

function offsetFor(i: number, selected: number | null): number {
  return i * PEEK + (selected !== null && i > selected ? WALLET_CARD_HEIGHT - PEEK + GAP : 0) - (i === selected ? LIFT : 0);
}

/**
 * Wallet-style stack: each pass overlaps the previous so only its header shows.
 * Tapping a pass lifts and expands it; tapping the expanded pass opens it.
 */
export function WalletStack({ items, onOpen }: { items: WalletItem[]; onOpen: (item: WalletItem) => void }) {
  const t = useTheme();
  const [selected, setSelected] = useState<number | null>(null);
  const anims = useRef(new Map<string, { y: Animated.Value; scale: Animated.Value }>()).current;

  const animFor = (key: string, i: number) => {
    let a = anims.get(key);
    if (!a) {
      a = { y: new Animated.Value(offsetFor(i, selected)), scale: new Animated.Value(1) };
      anims.set(key, a);
    }
    return a;
  };

  useEffect(() => {
    if (selected !== null && selected >= items.length) setSelected(null);
  }, [items.length, selected]);

  useEffect(() => {
    const animations = items.map((item, i) => {
      const a = animFor(item.key, i);
      const y = offsetFor(i, selected);
      const scale = i === selected ? 1.02 : 1;
      if (t.reduceMotion) {
        a.y.setValue(y);
        a.scale.setValue(scale);
        return null;
      }
      return Animated.parallel([
        Animated.spring(a.y, { toValue: y, useNativeDriver: true, damping: 18, stiffness: 190, mass: 0.9 }),
        Animated.spring(a.scale, { toValue: scale, useNativeDriver: true, damping: 16, stiffness: 220 }),
      ]);
    });
    const running = animations.filter((x): x is Animated.CompositeAnimation => x !== null);
    const group = Animated.parallel(running);
    group.start();
    return () => group.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, items, t.reduceMotion]);

  const n = items.length;
  const expandedExtra = selected !== null && selected < n - 1 ? WALLET_CARD_HEIGHT - PEEK + GAP : 0;
  const height = n === 0 ? 0 : (n - 1) * PEEK + WALLET_CARD_HEIGHT + expandedExtra + (selected !== null ? 44 : 0);

  return (
    <View style={{ height, marginTop: LIFT }}>
      {items.map((item, i) => {
        const a = animFor(item.key, i);
        const expanded = i === selected || (selected === null && i === n - 1);
        return (
          <Animated.View
            key={item.key}
            style={{ position: 'absolute', left: 0, right: 0, top: 0, zIndex: i, transform: [{ translateY: a.y }, { scale: a.scale }] }}
          >
            <Pressable
              onPress={() => {
                if (expanded) {
                  haptic.tap();
                  onOpen(item);
                } else {
                  haptic.light();
                  setSelected(i);
                }
              }}
              accessibilityRole="button"
              accessibilityLabel={`${item.name}, ${formatDateShort(item.start)}${item.kind === 'rsvp' ? ', RSVP' : `, ${item.typeName} times ${item.qty}`}`}
              accessibilityHint={expanded ? (item.kind === 'rsvp' ? 'Opens the event' : 'Opens your ticket QR code') : 'Expands this ticket'}
              accessibilityState={{ expanded }}
              style={({ pressed }) => ({ opacity: pressed && expanded ? 0.92 : 1 })}
            >
              <WalletTicketCard item={item} />
            </Pressable>
          </Animated.View>
        );
      })}
      {selected !== null ? (
        <Pressable
          onPress={() => {
            haptic.tap();
            setSelected(null);
          }}
          accessibilityRole="button"
          accessibilityLabel="Collapse tickets"
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 44 }}
        >
          <View style={{ alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: t.c.borderStrong, marginTop: 18 }} />
        </Pressable>
      ) : null}
    </View>
  );
}
