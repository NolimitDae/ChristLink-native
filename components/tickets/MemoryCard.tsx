import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
import { formatDateShort } from '../../lib/format';
import { AppText } from '../ui/AppText';
import type { WalletItem } from './walletItems';

/** A past event, shown as a warm keepsake: toned cover, name, date, "You were there". */
export function MemoryCard({ item, width, onPress }: { item: WalletItem; width: number; onPress: () => void }) {
  const t = useTheme();
  const year = item.start ? new Date(item.start).getFullYear() : null;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${formatDateShort(item.start)}. You were there.`}
      style={({ pressed }) => [
        styles.card,
        { width, backgroundColor: t.c.surface, borderColor: t.c.border, borderRadius: t.radius.lg, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={[styles.cover, { backgroundColor: t.c.surface3 }]}>
        {item.coverUrl ? (
          <Image source={{ uri: item.coverUrl }} style={[StyleSheet.absoluteFill, { opacity: 0.78 }]} resizeMode="cover" accessibilityIgnoresInvertColors />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.center]}>
            <Ionicons name="images-outline" size={28} color={t.c.goldText} />
          </View>
        )}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: t.c.goldDim }]} />
        <LinearGradient colors={['transparent', t.c.surface]} style={styles.fade} />
        {year ? (
          <View style={[styles.year, { borderColor: t.c.goldHairline, backgroundColor: t.c.surface }]}>
            <AppText variant="caption" tone="gold" style={{ fontSize: 11 }}>
              {year}
            </AppText>
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        <AppText variant="headline" numberOfLines={2} style={{ fontFamily: t.fonts.display, fontSize: 17, lineHeight: 21 }}>
          {item.name}
        </AppText>
        <AppText variant="caption" tone="muted" numberOfLines={1}>
          {formatDateShort(item.start)}
        </AppText>
        <View style={styles.there}>
          <Ionicons name="heart" size={12} color={t.c.goldText} />
          <AppText variant="caption" tone="gold" style={{ fontSize: 11 }}>
            You were there
          </AppText>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, overflow: 'hidden' },
  cover: { height: 108, overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center' },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 44 },
  year: { position: 'absolute', top: 8, left: 8, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  body: { paddingHorizontal: 12, paddingBottom: 12, paddingTop: 2, gap: 2 },
  there: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
});
