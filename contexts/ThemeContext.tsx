import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, StyleSheet, useColorScheme } from 'react-native';
import { buildTheme, resolveScheme, type Theme, type ThemePreference } from '../lib/theme';
import { storage } from '../lib/storage';

interface ThemeContextValue {
  theme: Theme;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [preference, setPref] = useState<ThemePreference>('system');
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    storage.getThemePreference().then(setPref);
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  const setPreference = useCallback((p: ThemePreference) => {
    setPref(p);
    storage.setThemePreference(p);
  }, []);

  const theme = useMemo(
    () => buildTheme(resolveScheme(preference, system), reduceMotion),
    [preference, system, reduceMotion],
  );

  const value = useMemo(() => ({ theme, preference, setPreference }), [theme, preference, setPreference]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

export function useTheme(): Theme {
  return useThemeContext().theme;
}

/**
 * Theme-aware StyleSheet: define styles once at module scope with `makeStyles(t => ({...}))`
 * and call the returned hook inside the component.
 */
export function makeStyles<T extends Parameters<typeof StyleSheet.create>[0]>(factory: (t: Theme) => T) {
  const cache = new Map<string, T>();
  return function useStyles(): T {
    const t = useTheme();
    const key = `${t.scheme}`;
    let styles = cache.get(key);
    if (!styles) {
      styles = StyleSheet.create(factory(t));
      cache.set(key, styles);
    }
    return styles;
  };
}
