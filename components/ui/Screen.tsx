import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { AppText } from './AppText';
import { IconButton } from './IconButton';

/** Plain screen background with optional stack header (back button, serif title, right slot). */
export function Screen({
  children,
  title,
  back = false,
  right,
  style,
  edges = ['top'],
}: {
  children: React.ReactNode;
  title?: string;
  back?: boolean;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  edges?: ('top' | 'bottom')[];
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View
      style={[
        styles.root,
        { backgroundColor: t.c.bg, paddingTop: edges.includes('top') ? insets.top : 0, paddingBottom: edges.includes('bottom') ? insets.bottom : 0 },
        style,
      ]}
    >
      {title || back || right ? (
        <View style={styles.header}>
          {back ? (
            <IconButton icon="chevron-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} />
          ) : null}
          <AppText variant="title2" numberOfLines={1} style={{ flex: 1 }}>
            {title ?? ''}
          </AppText>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, minHeight: 56 },
});
