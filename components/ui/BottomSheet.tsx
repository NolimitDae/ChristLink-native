import React, { createContext, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { AppText } from './AppText';
import { IconButton } from './IconButton';
import { project, rubberband, SPRING } from '../../lib/motion';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  scroll?: boolean;
  maxHeightRatio?: number;
}

/** True inside a sheet: rows there are menu items, so ListRow drops its navigation chevron (HIG menus have none). */
export const InSheetContext = createContext(false);

const SCREEN_H = Dimensions.get('window').height;
/** Extra sheet below the screen edge, so pulling up (rubber-band) never shows a gap under it. */
const BLEED = 60;

export function BottomSheet({ visible, onClose, title, subtitle, children, footer, scroll = true, maxHeightRatio = 0.88 }: BottomSheetProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const translate = useRef(new Animated.Value(SCREEN_H)).current;
  const backdrop = useRef(new Animated.Value(0)).current;
  /** Measured sheet height (projection threshold, backdrop dimming while dragging). */
  const sheetH = useRef(400);
  /** Live on-screen offset, so a grab mid-animation starts exactly where the sheet is. */
  const live = useRef(SCREEN_H);
  const grabFrom = useRef(0);
  /** Finger speed (px/ms) when dismissed by a flick; the exit continues at that speed. */
  const flickExit = useRef<number | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const id = translate.addListener(({ value }) => {
      live.current = value;
    });
    return () => translate.removeListener(id);
  }, [translate]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      flickExit.current = null;
      translate.setValue(t.reduceMotion ? 0 : SCREEN_H * 0.5);
      Animated.parallel([
        t.reduceMotion
          ? Animated.timing(translate, { toValue: 0, duration: 0, useNativeDriver: true })
          : Animated.spring(translate, { toValue: 0, ...SPRING.sheet, useNativeDriver: true }),
        Animated.timing(backdrop, { toValue: 1, duration: t.motion.base, useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      const v = flickExit.current;
      flickExit.current = null;
      const remaining = Math.max(0, SCREEN_H - live.current);
      // A flick keeps the finger's speed (linear, no seam); a tap on close/backdrop eases out
      const exit =
        v !== null && !t.reduceMotion
          ? Animated.timing(translate, { toValue: SCREEN_H, duration: Math.min(320, Math.max(120, remaining / v)), easing: Easing.linear, useNativeDriver: true })
          : Animated.timing(translate, { toValue: SCREEN_H * 0.6, duration: t.reduceMotion ? 0 : t.motion.base, easing: Easing.in(Easing.quad), useNativeDriver: true });
      Animated.parallel([exit, Animated.timing(backdrop, { toValue: 0, duration: t.motion.base, useNativeDriver: true })]).start(() => setMounted(false));
    }
  }, [visible, mounted, translate, backdrop, t.reduceMotion, t.motion.base]);

  const settle = (velocity: number) => {
    Animated.parallel([
      Animated.spring(translate, { toValue: 0, velocity, ...SPRING.sheet, useNativeDriver: true }),
      Animated.timing(backdrop, { toValue: 1, duration: t.motion.fast, useNativeDriver: true }),
    ]).start();
  };

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 8 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderGrant: () => {
        // Grab it wherever it is, even mid-spring
        translate.stopAnimation(v => {
          grabFrom.current = v;
        });
        backdrop.stopAnimation();
      },
      onPanResponderMove: (_e, g) => {
        const raw = grabFrom.current + g.dy;
        // 1:1 downward; upward resists progressively instead of hitting a wall
        const y = raw >= 0 ? raw : rubberband(raw, BLEED);
        translate.setValue(y);
        backdrop.setValue(Math.max(0, Math.min(1, 1 - y / (sheetH.current * 1.2))));
      },
      onPanResponderRelease: (_e, g) => {
        // Decide from where the flick is heading, not where the finger let go
        const landing = live.current + project(g.vy * 1000);
        if (landing > sheetH.current * 0.5 && g.vy > -0.05) {
          flickExit.current = Math.max(g.vy, 0.8);
          onCloseRef.current();
        } else {
          settle(g.vy);
        }
      },
      onPanResponderTerminate: (_e, g) => settle(g.vy),
    }),
  ).current;

  if (!mounted) return null;
  const Body = scroll ? ScrollView : View;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: t.c.overlay, opacity: backdrop }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
      </Animated.View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.kav} pointerEvents="box-none">
        <Animated.View
          accessibilityViewIsModal
          onLayout={e => {
            sheetH.current = e.nativeEvent.layout.height - BLEED;
          }}
          style={[
            styles.sheet,
            {
              maxHeight: SCREEN_H * maxHeightRatio + BLEED,
              marginBottom: -BLEED,
              paddingBottom: BLEED,
              backgroundColor: t.c.bgElevated,
              borderColor: t.c.border,
              borderTopLeftRadius: t.radius.xl,
              borderTopRightRadius: t.radius.xl,
              transform: [{ translateY: translate }],
            },
          ]}
        >
          <View {...pan.panHandlers} style={styles.handleArea}>
            <View style={[styles.handle, { backgroundColor: t.c.borderStrong }]} />
            {title ? (
              <View style={styles.header}>
                <View style={{ flex: 1 }}>
                  <AppText variant="title3">{title}</AppText>
                  {subtitle ? (
                    <AppText variant="callout" tone="muted" style={{ marginTop: 2 }}>
                      {subtitle}
                    </AppText>
                  ) : null}
                </View>
                <IconButton icon="close" label="Close" size={34} onPress={onClose} />
              </View>
            ) : null}
          </View>
          <Body
            style={scroll ? undefined : { flexShrink: 1 }}
            contentContainerStyle={scroll ? { paddingHorizontal: t.space.md, paddingBottom: footer ? t.space.md : insets.bottom + t.space.lg } : undefined}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <InSheetContext.Provider value={true}>
              {scroll ? children : <View style={{ paddingHorizontal: t.space.md, paddingBottom: footer ? t.space.md : insets.bottom + t.space.lg }}>{children}</View>}
            </InSheetContext.Provider>
          </Body>
          {footer ? (
            <View style={[styles.footer, { borderTopColor: t.c.border, paddingBottom: insets.bottom + t.space.sm }]}>{footer}</View>
          ) : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderWidth: StyleSheet.hairlineWidth, borderBottomWidth: 0, overflow: 'hidden' },
  handleArea: { paddingTop: 8 },
  handle: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 8 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, gap: 12 },
  footer: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
