import { Animated, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { SPRING } from './motion';

/**
 * iOS 26-style tab bar minimizing: scrolling down through content compacts the floating tab bar (labels fade, icons
 * settle to the middle); scrolling back up or reaching the top restores it. 0 = full, 1 = compact.
 * Driven by `trackTabBarScroll` from scroll handlers (useCollapsingTitle wires it up).
 */
export const tabBarCompact = new Animated.Value(0);

let compact = false;
let lastY: number | null = null;
/** Where the current scroll direction began; a deliberate run of DISTANCE points in one direction flips the state. */
let anchor = 0;
let direction = 0;

/** Ignore jitter and slow drift: only a deliberate scroll this long changes the state. */
const DISTANCE = 24;
/** Never compact near the top, where the full bar costs nothing. */
const TOP_ZONE = 80;

export function setTabBarCompact(on: boolean) {
  if (on === compact) return;
  compact = on;
  Animated.spring(tabBarCompact, { toValue: on ? 1 : 0, ...SPRING.move, useNativeDriver: true }).start();
}

export function trackTabBarScroll(y: number) {
  // The first event after a tab switch only records where this screen is
  if (lastY === null) {
    lastY = anchor = y;
    return;
  }
  const dir = Math.sign(y - lastY);
  lastY = y;
  if (y < TOP_ZONE) {
    setTabBarCompact(false);
    return;
  }
  if (dir === 0) return;
  if (dir !== direction) {
    direction = dir;
    anchor = y;
    return;
  }
  if (Math.abs(y - anchor) >= DISTANCE) setTabBarCompact(dir > 0);
}

/** A new screen or tab starts with the full bar. */
export function resetTabBarScroll() {
  lastY = null;
  direction = 0;
  setTabBarCompact(false);
}

/** `onScroll` for lists that don't use a collapsing title: only minimizes the tab bar. Pair with scrollEventThrottle={32}. */
export function onScrollTabBar(e: NativeSyntheticEvent<NativeScrollEvent>) {
  trackTabBarScroll(e.nativeEvent.contentOffset.y);
}
