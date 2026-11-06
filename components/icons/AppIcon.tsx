import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { FILL_GLYPHS, STROKE_GLYPHS } from './glyphs';

type IonName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * Faith-specific glyphs Ionicons doesn't have. `-outline` matches Ionicons' outline weight; plain = solid.
 * pray = praying hands (prayer, "I prayed", Amen) · church = church building · serve = hand holding a heart
 * (serve / volunteer) · bible = book with a cross · skate = roller skate.
 */
export type CustomIconName =
  | 'pray-outline'
  | 'pray'
  | 'church-outline'
  | 'church'
  | 'serve-outline'
  | 'serve'
  | 'bible-outline'
  | 'skate-outline';

/** Any icon the app can draw: an Ionicons name or one of the custom glyphs above. */
export type AppIconName = IonName | CustomIconName;

const CUSTOM = new Set<string>(['pray-outline', 'pray', 'church-outline', 'church', 'serve-outline', 'serve', 'bible-outline', 'skate-outline']);

export function isCustomIcon(name: string): name is CustomIconName {
  return CUSTOM.has(name);
}

export function AppIcon({ name, size = 20, color }: { name: AppIconName; size?: number; color: string }) {
  if (!isCustomIcon(name)) return <Ionicons name={name} size={size} color={color} />;

  const base = name.replace(/-outline$/, '') as 'pray' | 'church' | 'serve' | 'bible' | 'skate';
  if (base === 'bible' || base === 'skate') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden importantForAccessibility="no">
        {STROKE_GLYPHS[base].map(d => (
          <Path key={d} d={d} stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </Svg>
    );
  }
  const variant = name.endsWith('-outline') ? 'regular' : 'filled';
  return (
    <Svg width={size} height={size} viewBox="0 0 256 256" accessibilityElementsHidden importantForAccessibility="no">
      <Path d={FILL_GLYPHS[base][variant]} fill={color} />
    </Svg>
  );
}
