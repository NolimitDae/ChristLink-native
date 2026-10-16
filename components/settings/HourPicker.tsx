import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useTheme } from '../../contexts/ThemeContext';
import { BottomSheet, Button } from '../ui';

export function formatHour(hour: number | null | undefined): string {
  if (hour === null || hour === undefined) return 'Not set';
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function dateForHour(hour: number): Date {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return d;
}

/** Time picker that stores only the hour. Android shows the system dialog; iOS shows a spinner in a sheet. */
export function HourPicker({
  visible,
  title,
  hour,
  onClose,
  onPick,
}: {
  visible: boolean;
  title: string;
  hour: number;
  onClose: () => void;
  onPick: (hour: number) => void;
}) {
  const t = useTheme();
  const [value, setValue] = useState(dateForHour(hour));

  useEffect(() => {
    if (visible) setValue(dateForHour(hour));
  }, [visible, hour]);

  if (Platform.OS === 'android') {
    if (!visible) return null;
    return (
      <DateTimePicker
        value={value}
        mode="time"
        minuteInterval={30}
        onChange={(e: DateTimePickerEvent, d?: Date) => {
          onClose();
          if (e.type === 'set' && d) onPick(d.getHours());
        }}
      />
    );
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={title}
      footer={
        <Button
          title="Done"
          fullWidth
          onPress={() => {
            onPick(value.getHours());
            onClose();
          }}
        />
      }
    >
      <DateTimePicker
        value={value}
        mode="time"
        display="spinner"
        minuteInterval={30}
        themeVariant={t.scheme}
        textColor={t.c.text}
        onChange={(_e: DateTimePickerEvent, d?: Date) => d && setValue(d)}
      />
    </BottomSheet>
  );
}
