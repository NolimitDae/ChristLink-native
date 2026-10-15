import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { AppText, BottomSheet, Button } from '../ui';
import { formatClock } from './churchFormat';

function toDate(hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(2000, 0, 1, h || 0, m || 0);
}

function toHhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "HH:MM" picker: native dialog on Android, spinner in a sheet on iOS. */
export function TimeField({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(toDate(value));

  const onAndroid = (e: DateTimePickerEvent, d?: Date) => {
    setOpen(false);
    if (e.type === 'set' && d) onChange(toHhmm(d));
  };

  return (
    <>
      <Pressable
        onPress={() => {
          setDraft(toDate(value));
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${formatClock(value)}. Change time`}
        style={[styles.box, { backgroundColor: t.c.surface, borderColor: t.c.border, borderRadius: t.radius.md }]}
      >
        <Ionicons name="time-outline" size={16} color={t.c.goldText} />
        <AppText variant="bodyStrong">{formatClock(value)}</AppText>
      </Pressable>
      {open && Platform.OS === 'android' ? <DateTimePicker value={draft} mode="time" onChange={onAndroid} minuteInterval={5} /> : null}
      {Platform.OS === 'ios' ? (
        <BottomSheet
          visible={open}
          onClose={() => setOpen(false)}
          title={label}
          scroll={false}
          footer={
            <Button
              title="Done"
              fullWidth
              onPress={() => {
                onChange(toHhmm(draft));
                setOpen(false);
              }}
            />
          }
        >
          <DateTimePicker
            value={draft}
            mode="time"
            display="spinner"
            minuteInterval={5}
            themeVariant={t.scheme}
            textColor={t.c.text}
            onChange={(_e, d) => {
              if (d) setDraft(d);
            }}
          />
        </BottomSheet>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, minHeight: 50, borderWidth: 1, alignSelf: 'flex-start' },
});
