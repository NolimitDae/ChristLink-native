import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from './ThemeContext';
import { AppText } from '../components/ui/AppText';
import { shadow } from '../lib/theme';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => undefined });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const insets = useSafeAreaInsets();
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(x => x.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info') => {
      const id = `${Date.now()}-${Math.random()}`;
      setToasts(prev => [...prev.slice(-2), { id, message, type }]);
      AccessibilityInfo.announceForAccessibility(message);
      timers.current.set(id, setTimeout(() => removeToast(id), 3800));
    },
    [removeToast],
  );

  const icon = (type: ToastType) => (type === 'success' ? 'checkmark-circle' : type === 'error' ? 'alert-circle' : 'information-circle');
  const tint = (type: ToastType) => (type === 'success' ? t.c.success : type === 'error' ? t.c.danger : t.c.goldText);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <View style={[styles.container, { top: insets.top + (Platform.OS === 'android' ? 8 : 4) }]} pointerEvents="none">
        {toasts.map(x => (
          <View
            key={x.id}
            style={[
              styles.toast,
              { backgroundColor: t.c.bgElevated, borderColor: t.c.borderStrong, borderRadius: t.radius.md },
              shadow(3, t.c.shadow),
            ]}
          >
            <Ionicons name={icon(x.type)} size={20} color={tint(x.type)} />
            <AppText variant="callout" style={{ flex: 1 }}>
              {x.message}
            </AppText>
          </View>
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

const styles = StyleSheet.create({
  container: { position: 'absolute', left: 16, right: 16, zIndex: 9999, gap: 8 },
  toast: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderWidth: StyleSheet.hairlineWidth },
});
