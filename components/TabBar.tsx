import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTheme } from '../contexts/ThemeContext';
import { haptic } from '../lib/haptics';
import { shadow } from '../lib/theme';
import { AppText } from './ui/AppText';
import { Glass } from './ui/Glass';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const ICONS: Record<string, { on: IconName; off: IconName; label: string }> = {
  index: { on: 'home', off: 'home-outline', label: 'Home' },
  explore: { on: 'compass', off: 'compass-outline', label: 'Explore' },
  host: { on: 'add', off: 'add', label: 'Host' },
  community: { on: 'people', off: 'people-outline', label: 'Community' },
  tickets: { on: 'ticket', off: 'ticket-outline', label: 'Tickets' },
};

export const TAB_BAR_HEIGHT = 64;

/** Floating frosted tab bar with a raised gold Host button and a sliding active dot. */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const dotX = useRef(new Animated.Value(0)).current;
  const slot = width / state.routes.length;
  const activeName = state.routes[state.index]?.name;

  useEffect(() => {
    if (!slot) return;
    const to = state.index * slot + slot / 2 - 3;
    if (t.reduceMotion) dotX.setValue(to);
    else Animated.spring(dotX, { toValue: to, useNativeDriver: true, damping: 18, stiffness: 220 }).start();
  }, [state.index, slot, dotX, t.reduceMotion]);

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom, 10) }]}>
      <View style={[styles.shadowBox, shadow(3, t.c.shadow), { borderRadius: 32 }]}>
        <Glass style={[styles.bar, { borderColor: t.c.borderStrong }]} intensity={60}>
          <View style={styles.row} onLayout={e => setWidth(e.nativeEvent.layout.width)} accessibilityRole="tablist">
            {state.routes.map((route, index) => {
              const focused = state.index === index;
              const meta = ICONS[route.name] ?? { on: 'ellipse', off: 'ellipse-outline', label: route.name };
              const onPress = () => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                haptic.tap();
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
              };
              if (route.name === 'host') {
                return (
                  <Pressable
                    key={route.key}
                    onPress={onPress}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: focused }}
                    accessibilityLabel="Host an event"
                    style={styles.item}
                  >
                    <View style={[styles.host, { backgroundColor: t.c.gold, borderColor: t.c.bg }, shadow(2, '#8A6A1F')]}>
                      <Ionicons name="add" size={30} color={t.c.onGold} />
                    </View>
                  </Pressable>
                );
              }
              return (
                <Pressable
                  key={route.key}
                  onPress={onPress}
                  onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: focused }}
                  accessibilityLabel={meta.label}
                  style={styles.item}
                >
                  <Ionicons name={focused ? meta.on : meta.off} size={23} color={focused ? t.c.goldText : t.c.textMuted} />
                  <AppText variant="caption" color={focused ? t.c.text : t.c.textMuted} style={{ fontSize: 10, marginTop: 2 }}>
                    {meta.label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
          {slot > 0 && activeName !== 'host' ? (
            <Animated.View style={[styles.dot, { backgroundColor: t.c.gold, transform: [{ translateX: dotX }] }]} />
          ) : null}
        </Glass>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 14, right: 14 },
  shadowBox: { backgroundColor: 'transparent' },
  bar: { height: TAB_BAR_HEIGHT, borderRadius: 32, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', height: '100%' },
  host: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', marginTop: -26, borderWidth: 4 },
  dot: { position: 'absolute', bottom: 6, left: 0, width: 6, height: 6, borderRadius: 3 },
});
