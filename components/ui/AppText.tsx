import React from 'react';
import { Text, type TextProps } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import type { Palette, TypeVariant } from '../../lib/theme';

export type TextTone = 'default' | 'muted' | 'faint' | 'gold' | 'success' | 'danger' | 'onGold' | 'inverse';

interface AppTextProps extends TextProps {
  variant?: TypeVariant;
  tone?: TextTone;
  align?: 'left' | 'center' | 'right';
  color?: string;
}

function toneColor(c: Palette, tone: TextTone): string {
  switch (tone) {
    case 'muted':
      return c.textMuted;
    case 'faint':
      return c.textFaint;
    case 'gold':
      return c.goldText;
    case 'success':
      return c.success;
    case 'danger':
      return c.danger;
    case 'onGold':
      return c.onGold;
    case 'inverse':
      return '#F6EFE3';
    default:
      return c.text;
  }
}

export function AppText({ variant = 'body', tone = 'default', align, color, style, ...rest }: AppTextProps) {
  const t = useTheme();
  const isHeading = variant === 'display' || variant === 'title1' || variant === 'title2' || variant === 'title3';
  return (
    <Text
      accessibilityRole={isHeading ? 'header' : undefined}
      maxFontSizeMultiplier={isHeading ? 1.4 : 1.8}
      {...rest}
      style={[t.type[variant], { color: color ?? toneColor(t.c, tone) }, align ? { textAlign: align } : null, style]}
    />
  );
}
