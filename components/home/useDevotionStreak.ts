import { useEffect, useState } from 'react';
import { storage } from '../../lib/storage';
import { currentStreak, recordDay, weekDots } from '../../lib/streak';

export interface DevotionStreak {
  streak: number;
  dots: ReturnType<typeof weekDots>;
}

/** Counts today once the verse of the day is on screen, then reports the run and this week's dots. */
export function useDevotionStreak(verseShown: boolean): DevotionStreak | null {
  const [state, setState] = useState<DevotionStreak | null>(null);
  useEffect(() => {
    if (!verseShown) return;
    let cancelled = false;
    (async () => {
      const days = recordDay(await storage.getDevotionDays());
      await storage.setDevotionDays(days);
      if (!cancelled) setState({ streak: currentStreak(days), dots: weekDots(days) });
    })();
    return () => {
      cancelled = true;
    };
  }, [verseShown]);
  return state;
}
