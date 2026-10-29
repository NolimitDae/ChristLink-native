import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useTheme } from '../contexts/ThemeContext';
import { haptic } from '../lib/haptics';
import { fonts } from '../lib/theme';
import { AppText } from './ui/AppText';
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

/** Height of the bar above the home indicator. */
export const TAB_BAR_HEIGHT = 58;

/** Docked tab bar: five labelled tabs, gold when active. Screens end above it, so they need no extra padding. */
export function TabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  // Host is a hidden tab opened from Profile, so Profile stays highlighted there
  const activeName = state.routes[state.index]?.name === 'host' ? 'profile' : state.routes[state.index]?.name;

  return (
    <View
      style={[styles.bar, { backgroundColor: t.c.bgElevated, borderTopColor: t.c.border, paddingBottom: Math.max(insets.bottom, 6) }]}
      accessibilityRole="tablist"
    >
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
                <TicketIcon size={26} color={color} filled={focused} cutout={t.c.bgElevated} />
              ) : (
                <Ionicons name={focused ? meta.on : meta.off} size={24} color={color} />
              )}
            </View>
            <AppText variant="caption" color={color} numberOfLines={1} style={styles.label}>
              {meta.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth },
  item: { flex: 1, height: TAB_BAR_HEIGHT, alignItems: 'center', justifyContent: 'center', gap: 3 },
  // Same box for every glyph so all labels share one baseline
  icon: { height: 26, justifyContent: 'center', alignItems: 'center' },
  label: { fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 0.2 },
});
