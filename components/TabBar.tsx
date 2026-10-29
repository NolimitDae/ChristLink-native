import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
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
const TABS: Record<string, { on: IconName; off: IconName; label: string }> = {
  index: { on: 'compass', off: 'compass-outline', label: 'Discover' },
  explore: { on: 'calendar', off: 'calendar-outline', label: 'Events' },
  tickets: { on: 'ticket', off: 'ticket-outline', label: 'Tickets' }, // drawn with TicketIcon
  community: { on: 'people', off: 'people-outline', label: 'Community' },
  profile: { on: 'person', off: 'person-outline', label: 'Profile' },
};

export const TAB_BAR_HEIGHT = 56;
const RADIUS = TAB_BAR_HEIGHT / 2;
const SIDE = 14;

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

/** Floating frosted tab bar: five labelled tabs, gold when active. */
export function TabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  // Host is a hidden tab opened from Profile, so Profile stays highlighted there
  const activeName = state.routes[state.index]?.name === 'host' ? 'profile' : state.routes[state.index]?.name;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: barOffset(insets.bottom) }]}>
      <View style={[shadow(3, t.c.shadow), { borderRadius: RADIUS }]}>
        <Glass
          style={[
            styles.bar,
            { borderColor: t.c.borderStrong },
            // Real blur only exists on iOS; elsewhere a solid fill keeps scrolled content from ghosting through
            Platform.OS !== 'ios' && { backgroundColor: t.c.surface },
          ]}
          intensity={60}
        >
          <View style={styles.row} accessibilityRole="tablist">
            {state.routes.map((route, index) => {
              const meta = TABS[route.name];
              if (!meta) return null;
              const focused = route.name === activeName;
              const color = focused ? t.c.goldText : t.c.textMuted;
              const onPress = () => {
                const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                haptic.tap();
                // Compare with the real current route: Profile looks active on Host but must still navigate there
                if (state.index !== index && !event.defaultPrevented) navigateToTab(route.key);
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
                    {route.name === 'tickets' ? (
                      <TicketIcon size={24} color={color} filled={focused} cutout={Platform.OS === 'ios' ? t.c.bg : t.c.surface} />
                    ) : (
                      <Ionicons name={focused ? meta.on : meta.off} size={22} color={color} />
                    )}
                  </View>
                  <AppText variant="caption" color={color} numberOfLines={1} style={styles.label}>
                    {meta.label}
                  </AppText>
                </Pressable>
              );
            })}
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
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  item: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center', gap: 2 },
  // Same box for every glyph so all labels share one baseline
  icon: { height: 24, justifyContent: 'center', alignItems: 'center' },
  label: { fontFamily: fonts.semibold, fontSize: 10.5, letterSpacing: 0.1 },
});
