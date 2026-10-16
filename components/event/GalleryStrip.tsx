import React, { useState } from 'react';
import { FlatList, Image, Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../../contexts/ThemeContext';
import { AppText } from '../ui/AppText';
import { IconButton } from '../ui/IconButton';

export function GalleryStrip({ urls }: { urls: string[] }) {
  const t = useTheme();
  const [openAt, setOpenAt] = useState<number | null>(null);
  if (urls.length === 0) return null;
  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: t.space.xs, paddingHorizontal: t.space.md }}>
        {urls.map((u, i) => (
          <Pressable
            key={`${u}-${i}`}
            onPress={() => setOpenAt(i)}
            accessibilityRole="imagebutton"
            accessibilityLabel={`Photo ${i + 1} of ${urls.length}`}
            style={({ pressed }) => [styles.thumb, { borderRadius: t.radius.md, backgroundColor: t.c.surface2, opacity: pressed ? 0.8 : 1 }]}
          >
            <Image source={{ uri: u }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
          </Pressable>
        ))}
      </ScrollView>
      <GalleryViewer urls={urls} index={openAt} onClose={() => setOpenAt(null)} />
    </>
  );
}

function GalleryViewer({ urls, index, onClose }: { urls: string[]; index: number | null; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(0);
  return (
    <Modal visible={index !== null} animationType="fade" onRequestClose={onClose} statusBarTranslucent onShow={() => setPage(index ?? 0)}>
      <StatusBar style="light" />
      <View style={styles.viewer}>
        {index !== null ? (
          <FlatList
            data={urls}
            horizontal
            pagingEnabled
            initialScrollIndex={index}
            getItemLayout={(_d, i) => ({ length: width, offset: width * i, index: i })}
            keyExtractor={(u, i) => `${u}-${i}`}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={e => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
            renderItem={({ item, index: i }) => (
              <View style={{ width, height, justifyContent: 'center' }}>
                <Image
                  source={{ uri: item }}
                  style={{ width, height: height * 0.8 }}
                  resizeMode="contain"
                  accessible
                  accessibilityLabel={`Photo ${i + 1} of ${urls.length}`}
                />
              </View>
            )}
          />
        ) : null}
        <View style={[styles.viewerTop, { top: insets.top + 8 }]}>
          <AppText variant="callout" color="#F6EFE3">
            {page + 1} / {urls.length}
          </AppText>
          <IconButton icon="close" label="Close photos" tone="glass" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  thumb: { width: 128, height: 96, overflow: 'hidden' },
  viewer: { flex: 1, backgroundColor: '#000000' },
  viewerTop: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
