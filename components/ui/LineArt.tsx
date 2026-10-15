import React from 'react';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';

export type LineArtName = 'cross' | 'calendar' | 'ticket' | 'prayer' | 'people' | 'church' | 'serve' | 'search' | 'bell' | 'map' | 'offline';

/** Gold single-weight line illustrations for empty states. */
export function LineArt({ name, size = 96 }: { name: LineArtName; size?: number }) {
  const t = useTheme();
  const s = { stroke: t.c.goldText, strokeWidth: 1.6, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const halo = <Circle cx={48} cy={48} r={44} stroke={t.c.goldHairline} strokeWidth={1} fill="none" strokeDasharray="2 5" />;
  const art: Record<LineArtName, React.ReactNode> = {
    cross: (
      <>
        <Line x1={48} y1={22} x2={48} y2={74} {...s} />
        <Line x1={34} y1={36} x2={62} y2={36} {...s} />
      </>
    ),
    calendar: (
      <>
        <Rect x={26} y={30} width={44} height={40} rx={6} {...s} />
        <Line x1={26} y1={42} x2={70} y2={42} {...s} />
        <Line x1={37} y1={24} x2={37} y2={34} {...s} />
        <Line x1={59} y1={24} x2={59} y2={34} {...s} />
        <Line x1={48} y1={48} x2={48} y2={64} {...s} />
        <Line x1={42} y1={54} x2={54} y2={54} {...s} />
      </>
    ),
    ticket: (
      <>
        <Path d="M24 36 h48 v8 a5 5 0 0 0 0 10 v8 h-48 v-8 a5 5 0 0 0 0 -10 z" {...s} />
        <Line x1={56} y1={38} x2={56} y2={60} {...s} strokeDasharray="3 3" />
      </>
    ),
    prayer: (
      <>
        <Path d="M48 70 L40 46 Q38 36 44 30 L48 26 L52 30 Q58 36 56 46 Z" {...s} />
        <Path d="M40 46 L32 60 M56 46 L64 60" {...s} />
      </>
    ),
    people: (
      <>
        <Circle cx={38} cy={40} r={8} {...s} />
        <Circle cx={60} cy={40} r={8} {...s} />
        <Path d="M24 68 q14 -20 28 0 M46 68 q14 -20 28 0" {...s} />
      </>
    ),
    church: (
      <>
        <Path d="M30 72 V46 L48 32 L66 46 V72 Z" {...s} />
        <Line x1={48} y1={18} x2={48} y2={32} {...s} />
        <Line x1={42} y1={23} x2={54} y2={23} {...s} />
        <Path d="M43 72 V60 a5 5 0 0 1 10 0 V72" {...s} />
      </>
    ),
    serve: (
      <>
        <Path d="M26 56 q10 -8 20 0 l10 4 q6 2 4 7 l-18 -2" {...s} />
        <Path d="M26 70 h30 l16 -10 q4 -4 0 -7 l-10 4" {...s} />
        <Path d="M54 30 a6 6 0 0 1 10 6 l-8 8 l-8 -8 a6 6 0 0 1 6 -6" {...s} />
      </>
    ),
    search: (
      <>
        <Circle cx={44} cy={44} r={16} {...s} />
        <Line x1={56} y1={56} x2={68} y2={68} {...s} />
      </>
    ),
    bell: (
      <>
        <Path d="M34 62 V46 a14 14 0 0 1 28 0 V62 l4 4 H30 Z" {...s} />
        <Path d="M44 70 a4 4 0 0 0 8 0" {...s} />
      </>
    ),
    map: (
      <>
        <Path d="M48 72 C36 58 32 50 32 42 a16 16 0 0 1 32 0 c0 8 -4 16 -16 30 Z" {...s} />
        <Line x1={48} y1={34} x2={48} y2={50} {...s} />
        <Line x1={42} y1={39} x2={54} y2={39} {...s} />
      </>
    ),
    offline: (
      <>
        <Path d="M28 46 a28 28 0 0 1 40 0 M35 54 a18 18 0 0 1 26 0" {...s} />
        <Circle cx={48} cy={64} r={2.5} {...s} />
        <Line x1={28} y1={28} x2={68} y2={72} {...s} />
      </>
    ),
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {halo}
      {art[name]}
    </Svg>
  );
}

/** Pin-and-cross brand mark used on map markers and share cards. */
export function PinCross({ size = 34, fill, stroke }: { size?: number; fill?: string; stroke?: string }) {
  const t = useTheme();
  return (
    <Svg width={size} height={size * 1.25} viewBox="0 0 40 50">
      <Path
        d="M20 48 C8 33 3 26 3 18 a17 17 0 0 1 34 0 c0 8 -5 15 -17 30 Z"
        fill={fill ?? t.c.gold}
        stroke={stroke ?? t.c.bg}
        strokeWidth={2}
      />
      <Line x1={20} y1={8} x2={20} y2={28} stroke={t.c.onGold} strokeWidth={3} strokeLinecap="round" />
      <Line x1={13} y1={14} x2={27} y2={14} stroke={t.c.onGold} strokeWidth={3} strokeLinecap="round" />
    </Svg>
  );
}
