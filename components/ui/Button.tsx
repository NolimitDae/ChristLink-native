import React, { useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { haptic } from '../../lib/haptics';
import { AppText } from './AppText';
import { AppIcon, type AppIconName } from '../icons/AppIcon';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type IconName = AppIconName;

interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  testID?: string;
  haptics?: boolean;
}

const HEIGHT = { sm: 36, md: 48, lg: 56 } as const;
const PAD = { sm: 14, md: 20, lg: 24 } as const;

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  accessibilityHint,
  testID,
  haptics = true,
}: ButtonProps) {
  const t = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const inactive = disabled || loading;

  const bg =
    variant === 'primary' ? t.c.gold : variant === 'secondary' ? t.c.surface2 : variant === 'danger' ? t.c.dangerDim : 'transparent';
  const border = variant === 'secondary' ? t.c.borderStrong : variant === 'danger' ? t.c.danger : 'transparent';
  const fg = variant === 'primary' ? t.c.onGold : variant === 'danger' ? t.c.danger : variant === 'ghost' ? t.c.goldText : t.c.text;

  const animate = (to: number) => {
    if (t.reduceMotion) return;
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  };

  return (
    <Animated.View style={[{ transform: [{ scale }] }, fullWidth && styles.full, style]}>
      <Pressable
        testID={testID}
        onPress={() => {
          if (haptics) haptic.light();
          onPress?.();
        }}
        onPressIn={() => animate(0.97)}
        onPressOut={() => animate(1)}
        disabled={inactive}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: inactive, busy: loading }}
        hitSlop={size === 'sm' ? 6 : 0}
        style={({ pressed }) => [
          styles.base,
          {
            height: HEIGHT[size],
            paddingHorizontal: PAD[size],
            borderRadius: t.radius.pill,
            backgroundColor: pressed && variant === 'primary' ? t.c.goldPressed : bg,
            borderColor: border,
            borderWidth: variant === 'secondary' || variant === 'danger' ? 1 : 0,
            opacity: inactive && !loading ? 0.45 : pressed && variant !== 'primary' ? 0.7 : 1,
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={fg} accessibilityLabel="Loading" />
        ) : (
          <View style={styles.row}>
            {icon ? <AppIcon name={icon} size={size === 'sm' ? 16 : 18} color={fg} /> : null}
            <AppText variant="button" color={fg} style={size === 'sm' ? { fontSize: 13 } : null} numberOfLines={1}>
              {title}
            </AppText>
            {iconRight ? <AppIcon name={iconRight} size={size === 'sm' ? 16 : 18} color={fg} /> : null}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  full: { alignSelf: 'stretch' },
});
