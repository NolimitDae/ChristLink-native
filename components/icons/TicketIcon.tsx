import React from 'react';
import Svg, { G, Line, Path } from 'react-native-svg';

// Ticket body: rounded corners with half-circle notches cut into both short sides.
const BODY =
  'M5 5.5H19A2.5 2.5 0 0 1 21.5 8V9.6A2.4 2.4 0 0 0 21.5 14.4V16A2.5 2.5 0 0 1 19 18.5H5' +
  'A2.5 2.5 0 0 1 2.5 16V14.4A2.4 2.4 0 0 0 2.5 9.6V8A2.5 2.5 0 0 1 5 5.5Z';

/**
 * Ticket glyph for the tab bar: notched stub, dashed tear line and two "printed" lines.
 * Outline when inactive; filled with the details knocked out (in `cutout`) when active.
 */
export function TicketIcon({
  size = 24,
  color,
  filled = false,
  cutout,
}: {
  size?: number;
  color: string;
  filled?: boolean;
  /** Colour of the details on a filled ticket (the surface behind the icon). */
  cutout?: string;
}) {
  const detail = filled ? (cutout ?? '#000') : color;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      <G rotation={-12} origin="12, 12">
        <Path d={BODY} fill={filled ? color : 'none'} stroke={color} strokeWidth={1.7} strokeLinejoin="round" />
        <Line x1={15.6} y1={7.6} x2={15.6} y2={16.4} stroke={detail} strokeWidth={1.5} strokeLinecap="round" strokeDasharray="0.1 2.6" />
        <Line x1={6.4} y1={10.4} x2={11.6} y2={10.4} stroke={detail} strokeWidth={1.5} strokeLinecap="round" />
        <Line x1={6.4} y1={13.6} x2={9.8} y2={13.6} stroke={detail} strokeWidth={1.5} strokeLinecap="round" />
      </G>
    </Svg>
  );
}
