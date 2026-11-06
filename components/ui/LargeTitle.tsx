import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View, type ScrollViewInstance, type NativeScrollEvent, type NativeSyntheticEvent, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { trackTabBarScroll } from '../../lib/tabBarMotion';
import { AppText } from './AppText';
import { Glass } from './Glass';

/** Points of scroll at which the large title has slid under the bar and the compact title takes over. */
const COLLAPSE_AT = 40;
const BAR_HEIGHT = 44;

/**
 * iOS large-title behaviour for a scroll view: returns the scroll value and an `onScroll` handler (native driver)
 * that also minimizes the tab bar while scrolling down.
 */
export function useCollapsingTitle() {
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollViewInstance>(null);
  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: true,
        listener: (e: NativeSyntheticEvent<NativeScrollEvent>) => trackTabBarScroll(e.nativeEvent.contentOffset.y),
      }),
    [scrollY],
  );
  const scrollToTop = useMemo(() => () => scrollRef.current?.scrollTo({ y: 0, animated: true }), []);
  return { scrollY, onScroll, scrollRef, scrollToTop };
}

/** The large serif title at the top of the content. Pulling down past the top grows it slightly, anchored left. */
export function LargeTitle({ title, scrollY, style, children }: { title: string; scrollY: Animated.Value; style?: StyleProp<ViewStyle>; children?: React.ReactNode }) {
  const t = useTheme();
  const scale = t.reduceMotion ? 1 : scrollY.interpolate({ inputRange: [-120, 0], outputRange: [1.1, 1], extrapolate: 'clamp' });
  return (
    <View style={style}>
      <Animated.View style={{ transform: [{ scale }], transformOrigin: 'left center' }}>
        <AppText variant="display" accessibilityRole="header" numberOfLines={1}>
          {title}
        </AppText>
      </Animated.View>
      {children}
    </View>
  );
}

/**
 * The compact bar that appears once the large title scrolls under the status bar: frosted material, a centered
 * 17 pt title, and a hairline edge only while content is underneath (a scroll edge effect, not a permanent divider).
 * Takes no touches until it's shown (so pull-to-refresh and the content under it work); once shown it covers that
 * content, so it takes the touch itself and, like the iOS status bar, a tap scrolls back to the top.
 */
export function CompactTitleBar({
  title,
  scrollY,
  collapseAt = COLLAPSE_AT,
  onPress,
}: {
  title: string;
  scrollY: Animated.Value;
  collapseAt?: number;
  onPress?: () => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [shown, setShown] = useState(false);
  useEffect(() => {
    // Re-renders only when the threshold is crossed, not on every scroll frame
    const id = scrollY.addListener(({ value }) => setShown(value >= collapseAt - 8));
    return () => scrollY.removeListener(id);
  }, [scrollY, collapseAt]);
  const bar = scrollY.interpolate({ inputRange: [collapseAt - 16, collapseAt], outputRange: [0, 1], extrapolate: 'clamp' });
  const titleIn = scrollY.interpolate({ inputRange: [collapseAt - 4, collapseAt + 10], outputRange: [0, 1], extrapolate: 'clamp' });
  const rise = t.reduceMotion ? 0 : scrollY.interpolate({ inputRange: [collapseAt - 4, collapseAt + 10], outputRange: [6, 0], extrapolate: 'clamp' });
  return (
    <View pointerEvents={shown ? 'auto' : 'none'} style={[styles.wrap, { height: insets.top + BAR_HEIGHT }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: bar }]}>
        <Glass
          intensity={70}
          style={[
            StyleSheet.absoluteFill,
            { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.c.border },
            // Only iOS has a real blur; a translucent fill elsewhere lets scrolled text ghost through, so go solid
            Platform.OS !== 'ios' && { backgroundColor: t.c.bg },
          ]}
        />
      </Animated.View>
      <Animated.View style={[styles.title, { top: insets.top, opacity: titleIn, transform: [{ translateY: rise }] }]}>
        <AppText variant="headline" numberOfLines={1} align="center" accessibilityElementsHidden importantForAccessibility="no">
          {title}
        </AppText>
      </Animated.View>
      {/* Last child so it sits on top and receives the touch */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onPress}
        disabled={!onPress}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5 },
  title: { position: 'absolute', left: 72, right: 72, height: BAR_HEIGHT, justifyContent: 'center' },
});
