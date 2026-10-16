import React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

const DIM = 'rgba(0,0,0,0.58)';
const CORNER = 34;
const STROKE = 4;

/** Dimmed camera surround with a centered square window and gold corner brackets. */
export function ScanFrame({ offsetY = 0 }: { offsetY?: number }) {
  const t = useTheme();
  const { width, height } = useWindowDimensions();
  const { top, size } = scanWindow(width, height, offsetY);
  const side = (width - size) / 2;
  const gold = t.c.gold;
  const corner = (pos: object) => <View style={[styles.corner, pos]} />;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} importantForAccessibility="no-hide-descendants">
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: top, backgroundColor: DIM }} />
      <View style={{ position: 'absolute', left: 0, right: 0, top: top + size, bottom: 0, backgroundColor: DIM }} />
      <View style={{ position: 'absolute', left: 0, width: side, top, height: size, backgroundColor: DIM }} />
      <View style={{ position: 'absolute', right: 0, width: side, top, height: size, backgroundColor: DIM }} />
      <View style={{ position: 'absolute', left: side, top, width: size, height: size }}>
        {corner({ top: 0, left: 0, borderTopWidth: STROKE, borderLeftWidth: STROKE, borderTopLeftRadius: 18, borderColor: gold })}
        {corner({ top: 0, right: 0, borderTopWidth: STROKE, borderRightWidth: STROKE, borderTopRightRadius: 18, borderColor: gold })}
        {corner({ bottom: 0, left: 0, borderBottomWidth: STROKE, borderLeftWidth: STROKE, borderBottomLeftRadius: 18, borderColor: gold })}
        {corner({ bottom: 0, right: 0, borderBottomWidth: STROKE, borderRightWidth: STROKE, borderBottomRightRadius: 18, borderColor: gold })}
      </View>
    </View>
  );
}

export function scanWindow(width: number, height: number, offsetY = 0): { top: number; size: number } {
  const size = Math.min(width * 0.72, 300);
  return { top: Math.max(0, (height - size) / 2 + offsetY), size };
}

const styles = StyleSheet.create({
  corner: { position: 'absolute', width: CORNER, height: CORNER },
});
