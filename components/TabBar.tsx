import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useTheme } from '../contexts/ThemeContext';
import { haptic } from '../lib/haptics';
import { fonts, shadow } from '../lib/theme';
import { AppText } from './ui/AppText';
import { Glass } from './ui/Glass';
import { TicketIcon } from './icons/TicketIcon';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** Tabs shown in the bar, in route order. Routes not listed here (e.g. `host`) stay reachable but hidden. */
const TABS: Record<string, { icon: IconName | 'ticket'; label: string }> = {
  index: { icon: 'compass-outline', label: 'Discover' },
  explore: { icon: 'calendar-outline', label: 'Events' },
  tickets: { icon: 'ticket', label: 'Tickets' }, // custom TicketIcon
  community: { icon: 'people-outline', label: 'Community' },
  profile: { icon: 'person-outline', label: 'Profile' },
};

export const TAB_BAR_HEIGHT = 60;
const RADIUS = TAB_BAR_HEIGHT / 2;
const INSET = 4; // gap between the bar edge and the active capsule
const SIDE = 10;

/** Distance from the bottom of the screen to the bar's bottom edge. */
function barOffset(insetBottom: number) {
  return Math.max(insetBottom, 10);
}

/**
 * Space a tab screen must leave at its bottom so the floating bar never covers content:
 * the bar, its offset from the screen edge and a small gap. Use it for list padding and floating buttons.
 */
export function useTabBarClearance(gap = 12): number {
  const insets = useSafeAreaInsets();
  return barOffset(insets.bottom) + TAB_BAR_HEIGHT + gap;
}

/** Floating frosted tab bar: five labelled tabs; a gold capsule slides behind the active one. */
export function TabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const capsuleX = useRef(new Animated.Value(0)).current;
  const placed = useRef(false);

  const visible = state.routes.filter(r => TABS[r.name]);
  // Host is a hidden tab opened from Profile, so Profile stays highlighted there
  const current = state.routes[state.index]?.name;
  const activeName = current === 'host' ? 'profile' : current;
  const activeIdx = visible.findIndex(r => r.name === activeName);
  const slot = width / Math.max(visible.length, 1);

  useEffect(() => {
    if (!slot || activeIdx < 0) return;
    const to = activeIdx * slot;
    // First placement and Reduce Motion jump; tab changes spring like the reference
    if (!placed.current || t.reduceMotion) {
      capsuleX.setValue(to);
      placed.current = true;
    } else {
      Animated.spring(capsuleX, { toValue: to, useNativeDriver: true, damping: 20, stiffness: 240, mass: 0.9 }).start();
    }
  }, [activeIdx, slot, capsuleX, t.reduceMotion]);

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: barOffset(insets.bottom) }]}>
      <View style={[shadow(3, t.c.shadow), { borderRadius: RADIUS }]}>
        <Glass
          style={[
            styles.bar,
            { borderColor: t.c.goldHairline },
            // Real blur only exists on iOS; elsewhere a solid fill keeps scrolled content from ghosting through
            Platform.OS !== 'ios' && { backgroundColor: t.c.surface },
          ]}
          intensity={60}
        >
          <View style={styles.inner} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
            {slot > 0 && activeIdx >= 0 ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.capsule,
                  { width: slot, backgroundColor: t.c.goldDim, borderColor: t.c.goldHairline, transform: [{ translateX: capsuleX }] },
                ]}
              />
            ) : null}
            <View style={styles.row} accessibilityRole="tablist">
              {visible.map(route => {
                const meta = TABS[route.name];
                const focused = route.name === activeName;
                const color = focused ? t.c.goldText : t.c.text;
                const onPress = () => {
                  const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                  haptic.tap();
                  // Compare with the real current route: Profile looks active on Host but must still navigate there
                  if (route.name !== current && !event.defaultPrevented) navigateToTab(route.key);
                };
                return (
                  <Pressable
                    key={route.key}
                    onPress={onPress}
                    onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: focused }}
                    accessibilityLabel={meta.label}
                    style={styles.item}
                  >
                    <View style={styles.icon}>
                      {meta.icon === 'ticket' ? (
                        <TicketIcon size={25} color={color} />
                      ) : (
                        <Ionicons name={meta.icon} size={23} color={color} />
                      )}
                    </View>
                    <AppText variant="caption" color={color} numberOfLines={1} style={styles.label}>
                      {meta.label}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Glass>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Above every screen's content (cards with shadows or transforms otherwise paint over it)
  wrap: { position: 'absolute', left: SIDE, right: SIDE, zIndex: 10, elevation: 12 },
  bar: { height: TAB_BAR_HEIGHT, borderRadius: RADIUS, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  inner: { flex: 1, margin: INSET },
  capsule: { position: 'absolute', top: 0, bottom: 0, left: 0, borderRadius: RADIUS - INSET, borderWidth: StyleSheet.hairlineWidth },
  row: { flex: 1, flexDirection: 'row' },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  // Same box for every glyph so all labels share one baseline
  icon: { height: 25, justifyContent: 'center', alignItems: 'center' },
  label: { fontFamily: fonts.bold, fontSize: 10.5, letterSpacing: 0.1 },
});
