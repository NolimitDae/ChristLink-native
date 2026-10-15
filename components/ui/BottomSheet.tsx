import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
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

const SCREEN_H = Dimensions.get('window').height;

export function BottomSheet({ visible, onClose, title, subtitle, children, footer, scroll = true, maxHeightRatio = 0.88 }: BottomSheetProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const translate = useRef(new Animated.Value(SCREEN_H)).current;
  const backdrop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translate.setValue(t.reduceMotion ? 0 : SCREEN_H * 0.5);
      Animated.parallel([
        Animated.spring(translate, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }),
        Animated.timing(backdrop, { toValue: 1, duration: t.motion.base, useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(translate, { toValue: SCREEN_H * 0.6, duration: t.reduceMotion ? 0 : t.motion.base, useNativeDriver: true }),
        Animated.timing(backdrop, { toValue: 0, duration: t.motion.base, useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
  }, [visible, mounted, translate, backdrop, t.reduceMotion, t.motion.base]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_e, g) => {
        if (g.dy > 0) translate.setValue(g.dy);
      },
      onPanResponderRelease: (_e, g) => {
        if (g.dy > 120 || g.vy > 1.2) onClose();
        else Animated.spring(translate, { toValue: 0, useNativeDriver: true }).start();
      },
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
          style={[
            styles.sheet,
            {
              maxHeight: SCREEN_H * maxHeightRatio,
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
            {scroll ? children : <View style={{ paddingHorizontal: t.space.md, paddingBottom: footer ? t.space.md : insets.bottom + t.space.lg }}>{children}</View>}
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
