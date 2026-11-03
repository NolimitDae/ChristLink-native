import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { SPRING } from '../../lib/motion';
import { resetTabBarScroll, trackTabBarScroll } from '../../lib/tabBarMotion';
import { AppText } from './AppText';

type ScrollHandler = (e: NativeSyntheticEvent<NativeScrollEvent>) => void;

/** Scrolled this far into the list, the title tucks away; it returns only near the very top (hysteresis). */
const COLLAPSE_AFTER = 40;
const EXPAND_BELOW = 8;

/**
 * translateY for anything pinned to the bottom of the content (floating buttons, map preview cards).
 * The content area is one title-height taller than the screen so it can slide up; this keeps those pinned.
 */
const FloatingOffsetContext = createContext<Animated.AnimatedInterpolation<number> | number>(0);
export function useFloatingOffset() {
  return useContext(FloatingOffsetContext);
}

/**
 * Large title for screens whose controls stay pinned (segmented switch, search): scrolling into the list tucks the
 * title away with a spring so the list gets the room, and the controls slide up under the status bar; back at the
 * top it returns. The title isn't part of the list, so this is a state change, not 1:1 tracking.
 * Reduce Motion: the title stays put.
 *
 * `children` receives the `onScroll` to give the active list (it also minimizes the tab bar).
 * Change `resetKey` when the list underneath is swapped (e.g. a different segment) to bring the title back.
 */
export function CollapsingHeader({
  title,
  controls,
  resetKey,
  children,
}: {
  title: string;
  controls?: React.ReactNode;
  resetKey?: string;
  children: (onScroll: ScrollHandler) => React.ReactNode;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;
  const collapsed = useRef(false);
  const [titleH, setTitleH] = useState(49);

  const set = useCallback(
    (on: boolean) => {
      if (on === collapsed.current) return;
      collapsed.current = on;
      Animated.spring(progress, { toValue: on ? 1 : 0, ...SPRING.move, useNativeDriver: true }).start();
    },
    [progress],
  );

  useEffect(() => {
    set(false);
    resetTabBarScroll();
  }, [resetKey, set]);

  useEffect(() => {
    if (t.reduceMotion) set(false);
  }, [t.reduceMotion, set]);

  const onScroll = useCallback<ScrollHandler>(
    e => {
      const y = e.nativeEvent.contentOffset.y;
      trackTabBarScroll(y);
      if (t.reduceMotion) return;
      if (y > COLLAPSE_AFTER) set(true);
      else if (y < EXPAND_BELOW) set(false);
    },
    [t.reduceMotion, set],
  );

  const { lift, fade, shrink, floating } = useMemo(
    () => ({
      lift: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -titleH] }),
      fade: progress.interpolate({ inputRange: [0, 0.6], outputRange: [1, 0], extrapolate: 'clamp' }),
      shrink: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.92] }),
      floating: progress.interpolate({ inputRange: [0, 1], outputRange: [-titleH, 0] }),
    }),
    [progress, titleH],
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg, paddingTop: insets.top, overflow: 'hidden' }}>
      {/* One title taller than the screen, so sliding up never opens a gap at the bottom */}
      <Animated.View style={{ flex: 1, marginBottom: -titleH, transform: [{ translateY: lift }] }}>
        <Animated.View
          onLayout={e => setTitleH(Math.round(e.nativeEvent.layout.height))}
          style={{ paddingHorizontal: t.space.md, paddingTop: t.space.xs, opacity: fade, transform: [{ scale: shrink }], transformOrigin: 'left bottom' }}
        >
          <AppText variant="display" accessibilityRole="header" numberOfLines={1}>
            {title}
          </AppText>
        </Animated.View>
        {controls ? <View style={{ paddingHorizontal: t.space.md, paddingTop: t.space.xs, paddingBottom: t.space.sm }}>{controls}</View> : null}
        {/* Scroll edge: a hairline under the pinned controls only while the list runs underneath them */}
        <Animated.View pointerEvents="none" style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.c.border, opacity: progress }} />
        <FloatingOffsetContext.Provider value={floating}>
          <View style={{ flex: 1 }}>{children(onScroll)}</View>
        </FloatingOffsetContext.Provider>
      </Animated.View>
      {/* Content that slides up passes under the status bar, not over it */}
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, backgroundColor: t.c.bg }} />
    </View>
  );
}
