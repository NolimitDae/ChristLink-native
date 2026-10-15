import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { haptic } from '../../lib/haptics';
import { AppText } from './AppText';

interface SegmentedProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  style?: StyleProp<ViewStyle>;
}

export function Segmented<T extends string>({ options, value, onChange, style }: SegmentedProps<T>) {
  const t = useTheme();
  const [width, setWidth] = useState(0);
  const idx = Math.max(0, options.findIndex(o => o.value === value));
  const x = useRef(new Animated.Value(0)).current;
  const segW = width / options.length;

  useEffect(() => {
    Animated.spring(x, { toValue: idx * segW, useNativeDriver: true, damping: 20, stiffness: 240 }).start();
  }, [idx, segW, x]);

  return (
    <View
      accessibilityRole="tablist"
      onLayout={e => setWidth(e.nativeEvent.layout.width - 8)}
      style={[styles.wrap, { backgroundColor: t.c.surface2, borderColor: t.c.border, borderRadius: t.radius.pill }, style]}
    >
      {width > 0 ? (
        <Animated.View
          style={[styles.thumb, { width: segW, backgroundColor: t.c.surface, borderColor: t.c.goldHairline, transform: [{ translateX: x }] }]}
        />
      ) : null}
      {options.map(o => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => {
              haptic.tap();
              onChange(o.value);
            }}
            style={styles.seg}
          >
            <AppText variant="caption" tone={selected ? 'default' : 'muted'} style={{ fontSize: 13 }}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', padding: 4, borderWidth: 1, height: 42 },
  thumb: { position: 'absolute', top: 4, bottom: 4, left: 4, borderRadius: 999, borderWidth: 1 },
  seg: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
