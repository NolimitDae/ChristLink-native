import React, { useEffect, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { countdownLabel, eventTiming } from '../../lib/format';
import { Badge } from '../ui/Badge';

/** "Live now" / "in 2h 10m" / "in 3d 4h"; updates every minute. */
export function CountdownChip({ start, end, style }: { start?: string; end?: string; style?: StyleProp<ViewStyle> }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  const timing = eventTiming(start, end, now);
  if (timing.kind === 'live') return <Badge label="Live now" tone="live" dot style={style} />;
  if (timing.kind === 'startsIn') return <Badge label={`in ${timing.label}`} tone="gold" style={style} />;
  if (timing.kind === 'upcoming' && start) return <Badge label={`in ${countdownLabel(new Date(start).getTime() - now)}`} tone="neutral" style={style} />;
  if (timing.kind === 'tba') return <Badge label="Date TBA" tone="neutral" style={style} />;
  return null;
}
