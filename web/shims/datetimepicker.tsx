/**
 * Web build of @react-native-community/datetimepicker (no web support upstream; metro.config.js maps it here for web
 * only). Renders the browser's own date/time input, which brings the platform picker, keyboard entry and screen-reader
 * support. Screens treat the web like iOS: the picker sits inline (DateTimeField) or in a sheet (TimeField, HourPicker).
 */
import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { fonts } from '../../lib/theme';

type Mode = 'date' | 'time' | 'datetime';
export type DateTimePickerEvent = { type: 'set' | 'dismissed' | 'neutralButtonPressed'; nativeEvent: { timestamp?: number } };

const pad = (n: number) => String(n).padStart(2, '0');
const datePart = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const timePart = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Date → the input's value string for a mode (local time, like the native pickers). */
export function toInputValue(d: Date, mode: Mode): string {
  if (mode === 'time') return timePart(d);
  if (mode === 'datetime') return `${datePart(d)}T${timePart(d)}`;
  return datePart(d);
}

/** The input's value string → a Date, keeping the parts that mode doesn't edit from `base`. Null when incomplete. */
export function fromInputValue(raw: string, mode: Mode, base: Date): Date | null {
  const out = new Date(base);
  if (mode === 'time') {
    const m = /^(\d{2}):(\d{2})/.exec(raw);
    if (!m) return null;
    out.setHours(Number(m[1]), Number(m[2]), 0, 0);
    return out;
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(raw);
  if (!m) return null;
  out.setFullYear(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (mode === 'datetime') {
    if (m[4] === undefined) return null;
    out.setHours(Number(m[4]), Number(m[5]), 0, 0);
  }
  return out;
}

interface Props {
  value: Date;
  mode?: Mode;
  onChange?: (e: DateTimePickerEvent, d?: Date) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  minuteInterval?: number;
  accessibilityLabel?: string;
  testID?: string;
  [rest: string]: unknown;
}

export default function DateTimePicker({ value, mode = 'date', onChange, minimumDate, maximumDate, minuteInterval, accessibilityLabel }: Props) {
  const t = useTheme();
  const type = mode === 'time' ? 'time' : mode === 'datetime' ? 'datetime-local' : 'date';
  return React.createElement('input', {
    type,
    value: toInputValue(value, mode),
    min: minimumDate ? toInputValue(minimumDate, mode) : undefined,
    max: maximumDate ? toInputValue(maximumDate, mode) : undefined,
    step: minuteInterval && mode !== 'date' ? minuteInterval * 60 : undefined,
    'aria-label': accessibilityLabel,
    onChange: (e: { target: { value: string } }) => {
      const d = fromInputValue(e.target.value, mode, value);
      if (d) onChange?.({ type: 'set', nativeEvent: { timestamp: d.getTime() } }, d);
    },
    style: {
      flex: 1,
      minHeight: 44,
      fontFamily: fonts.regular,
      fontSize: 17,
      color: t.c.text,
      background: 'transparent',
      border: 'none',
      outline: 'none',
      colorScheme: t.scheme,
      accentColor: t.c.gold,
    },
  });
}

/** Android's imperative dialog has no web equivalent; screens use the inline picker on web instead. */
export const DateTimePickerAndroid = { open: () => undefined, dismiss: async () => true };
