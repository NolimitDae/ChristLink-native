import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { Platform, StyleSheet, TextInput, View, type TextInputInstance } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

export const OTP_LENGTH = 6;

export interface OtpBoxesHandle {
  focus: () => void;
}

/** Six single-digit boxes with paste and SMS/email autofill support. */
export const OtpBoxes = forwardRef<OtpBoxesHandle, { value: string[]; onChange: (digits: string[]) => void; disabled?: boolean; error?: boolean }>(
  function OtpBoxes({ value, onChange, disabled, error }, ref) {
    const t = useTheme();
    const refs = useRef<(TextInputInstance | null)[]>([]);

    useImperativeHandle(ref, () => ({
      focus: () => {
        const firstEmpty = value.findIndex(d => !d);
        refs.current[firstEmpty === -1 ? OTP_LENGTH - 1 : firstEmpty]?.focus();
      },
    }));

    const handle = (text: string, index: number) => {
      const digits = text.replace(/\D/g, '');
      if (digits.length >= OTP_LENGTH) {
        const filled = digits.slice(0, OTP_LENGTH).split('');
        onChange(filled);
        refs.current[OTP_LENGTH - 1]?.blur();
        return;
      }
      const next = [...value];
      if (digits.length > 1) {
        digits.split('').forEach((d, i) => {
          if (index + i < OTP_LENGTH) next[index + i] = d;
        });
        onChange(next);
        refs.current[Math.min(OTP_LENGTH - 1, index + digits.length)]?.focus();
        return;
      }
      next[index] = digits.slice(-1);
      onChange(next);
      if (digits && index < OTP_LENGTH - 1) refs.current[index + 1]?.focus();
    };

    return (
      <View style={styles.row}>
        {value.map((d, i) => (
          <TextInput
            key={i}
            ref={r => {
              refs.current[i] = r;
            }}
            value={d}
            onChangeText={text => handle(text, i)}
            onKeyPress={({ nativeEvent }) => {
              if (nativeEvent.key === 'Backspace' && !value[i] && i > 0) {
                const next = [...value];
                next[i - 1] = '';
                onChange(next);
                refs.current[i - 1]?.focus();
              }
            }}
            keyboardType="number-pad"
            textContentType={i === 0 ? 'oneTimeCode' : 'none'}
            autoComplete={i === 0 ? (Platform.OS === 'android' ? 'sms-otp' : 'one-time-code') : 'off'}
            maxLength={OTP_LENGTH}
            editable={!disabled}
            selectTextOnFocus
            selectionColor={t.c.gold}
            accessibilityLabel={`Digit ${i + 1} of ${OTP_LENGTH}`}
            style={[
              styles.box,
              t.type.title2,
              {
                color: t.c.text,
                backgroundColor: t.c.surface,
                borderRadius: t.radius.md,
                borderColor: error ? t.c.danger : d ? t.c.goldHairline : t.c.border,
              },
            ]}
          />
        ))}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  box: { flex: 1, height: 58, textAlign: 'center', borderWidth: 1.5, maxWidth: 54 },
});
