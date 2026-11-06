import React from 'react';
import { StyleSheet, View } from 'react-native';
import { INTEREST_TYPES } from '../../lib/interests';
import { Chip } from '../ui';

/** Wrapping chips for the event types someone cares about; keeps the order they were picked in. */
export function InterestPicker({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  return (
    <View style={styles.wrap}>
      {INTEREST_TYPES.map(type => {
        const on = value.includes(type);
        return <Chip key={type} label={type} selected={on} onPress={() => onChange(on ? value.filter(v => v !== type) : [...value, type])} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
