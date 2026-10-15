import React from 'react';
import { Platform, Pressable, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { makeStyles, useTheme } from '../../contexts/ThemeContext';
import { formatDateShort, formatTime } from '../../lib/format';
import { AppText } from '../ui';

interface DateTimeFieldProps {
  label: string;
  value: Date | null;
  onChange: (d: Date) => void;
  minimumDate?: Date;
  /** Used as the starting value when nothing is chosen yet. */
  suggested?: () => Date;
  error?: string | null;
  hint?: string;
}

export function nextRoundHour(offsetHours = 24): Date {
  const d = new Date(Date.now() + offsetHours * 3_600_000);
  d.setMinutes(0, 0, 0);
  return d;
}

export function DateTimeField({ label, value, onChange, minimumDate, suggested, error, hint }: DateTimeFieldProps) {
  const t = useTheme();
  const s = useStyles();
  const base = () => value ?? suggested?.() ?? nextRoundHour();

  const openAndroid = () => {
    const start = base();
    DateTimePickerAndroid.open({
      value: start,
      mode: 'date',
      minimumDate,
      onChange: (e: DateTimePickerEvent, date?: Date) => {
        if (e.type !== 'set' || !date) return;
        const picked = new Date(date);
        picked.setHours(start.getHours(), start.getMinutes(), 0, 0);
        DateTimePickerAndroid.open({
          value: picked,
          mode: 'time',
          onChange: (e2: DateTimePickerEvent, time?: Date) => {
            if (e2.type !== 'set' || !time) return;
            const final = new Date(picked);
            final.setHours(time.getHours(), time.getMinutes(), 0, 0);
            onChange(final);
          },
        });
      },
    });
  };

  const display = value ? `${formatDateShort(value.toISOString())} · ${formatTime(value.toISOString())}` : 'Choose date & time';

  return (
    <View style={{ gap: 6 }}>
      <AppText variant="caption" tone="muted" style={{ fontSize: 13 }}>
        {label}
      </AppText>
      {Platform.OS === 'ios' && value ? (
        <View style={[s.box, error ? { borderColor: t.c.danger } : null]}>
          <Ionicons name="calendar-outline" size={18} color={t.c.goldText} />
          <View style={{ flex: 1 }} />
          <DateTimePicker
            value={value}
            mode="datetime"
            display="compact"
            minimumDate={minimumDate}
            themeVariant={t.scheme}
            accentColor={t.c.gold}
            minuteInterval={5}
            onChange={(_e, d) => d && onChange(d)}
            accessibilityLabel={label}
          />
        </View>
      ) : (
        <Pressable
          onPress={() => (Platform.OS === 'ios' ? onChange(base()) : openAndroid())}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${display}`}
          style={({ pressed }) => [s.box, error ? { borderColor: t.c.danger } : null, { opacity: pressed ? 0.75 : 1 }]}
        >
          <Ionicons name="calendar-outline" size={18} color={t.c.goldText} />
          <AppText variant="body" tone={value ? 'default' : 'faint'} style={{ flex: 1 }}>
            {display}
          </AppText>
          <Ionicons name="chevron-forward" size={16} color={t.c.textFaint} />
        </Pressable>
      )}
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
}

const useStyles = makeStyles(t => ({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 50,
    paddingHorizontal: 14,
    borderRadius: t.radius.md,
    borderWidth: 1,
    borderColor: t.c.border,
    backgroundColor: t.c.surface,
  },
}));
