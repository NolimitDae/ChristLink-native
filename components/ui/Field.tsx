import React, { forwardRef, useState } from 'react';
import { StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle, type TextInputInstance, Platform, type TextStyle } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { AppText } from './AppText';

interface FieldProps extends TextInputProps {
  label?: string;
  hint?: string;
  error?: string | null;
  containerStyle?: StyleProp<ViewStyle>;
  left?: React.ReactNode;
  /** Override the default box height (e.g. a one-line chat composer that grows when multiline). */
  minHeight?: number;
}

export const Field = forwardRef<TextInputInstance, FieldProps>(function Field(
  { label, hint, error, containerStyle, left, style, multiline, onFocus, onBlur, minHeight, ...rest },
  ref,
) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={[{ gap: 6 }, containerStyle]}>
      {label ? (
        <AppText variant="caption" tone="muted" style={{ fontSize: 13 }}>
          {label}
        </AppText>
      ) : null}
      <View
        style={[
          styles.box,
          {
            backgroundColor: t.c.surface,
            borderColor: error ? t.c.danger : focused ? t.c.goldHairline : t.c.border,
            borderRadius: t.radius.md,
            minHeight: minHeight ?? (multiline ? 104 : 50),
            alignItems: multiline ? 'flex-start' : 'center',
          },
        ]}
      >
        {left}
        <TextInput
          ref={ref}
          placeholderTextColor={t.c.textFaint}
          selectionColor={t.c.gold}
          multiline={multiline}
          accessibilityLabel={label}
          accessibilityHint={hint}
          onFocus={e => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={e => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            t.type.body,
            styles.input,
            {
              color: t.c.text,
              textAlignVertical: multiline ? 'top' : 'center',
              paddingTop: multiline ? 12 : 0,
              minHeight: minHeight !== undefined ? Math.max(0, minHeight - 2) : 48,
            },
            // Web: the box's gold border is the focus indicator; the browser's own ring doubled it inside the field
            WEB_NO_OUTLINE,
            style,
          ]}
          {...rest}
        />
      </View>
      {error ? (
        <AppText variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" tone="faint">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
});

const WEB_NO_OUTLINE = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null;

const styles = StyleSheet.create({
  box: { flexDirection: 'row', borderWidth: 1, paddingHorizontal: 14, gap: 8 },
  input: { flex: 1 },
});
