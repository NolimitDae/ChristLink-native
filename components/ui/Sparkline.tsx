import React from 'react';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';

export function sparkPath(values: number[], width: number, height: number): { line: string; area: string } {
  if (values.length === 0) return { line: '', area: '' };
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  const pts = values.map((v, i) => [i * step, height - 2 - (v / max) * (height - 4)] as const);
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area = `${line} L${width} ${height} L0 ${height} Z`;
  return { line, area };
}

export function Sparkline({ values, width = 96, height = 32, color }: { values: number[]; width?: number; height?: number; color?: string }) {
  const t = useTheme();
  const stroke = color ?? t.c.goldText;
  const { line, area } = sparkPath(values, width, height);
  if (!line) return null;
  return (
    <Svg width={width} height={height} accessibilityLabel={`Trend over ${values.length} days`}>
      <Defs>
        <LinearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={stroke} stopOpacity={0.28} />
          <Stop offset="1" stopColor={stroke} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path d={area} fill="url(#spark)" />
      <Path d={line} stroke={stroke} strokeWidth={1.8} fill="none" strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}
