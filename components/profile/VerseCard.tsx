import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { AppText, Card, IconButton } from '../ui';

export function ProfileVerseCard({ verse, reference, onShare }: { verse: string; reference?: string; onShare?: () => void }) {
  const t = useTheme();
  return (
    <Card variant="featured" style={{ marginHorizontal: t.space.md }}>
      <View style={{ flexDirection: 'row', gap: t.space.sm }}>
        <AppText variant="display" tone="gold" style={{ lineHeight: 40, marginTop: -4 }} accessibilityElementsHidden>
          “
        </AppText>
        <View style={{ flex: 1 }}>
          <AppText variant="title3" style={{ lineHeight: 28 }}>
            {verse}
          </AppText>
          {reference ? (
            <AppText variant="overline" tone="gold" style={{ marginTop: t.space.xs }}>
              {reference}
            </AppText>
          ) : null}
        </View>
        {onShare ? <IconButton icon="share-outline" label="Share verse" size={36} onPress={onShare} /> : null}
      </View>
    </Card>
  );
}

export function PinnedPrayerCard({ text }: { text: string }) {
  const t = useTheme();
  return (
    <Card style={{ marginHorizontal: t.space.md, gap: 6 }}>
      <AppText variant="overline" tone="gold">
        Pinned prayer
      </AppText>
      <AppText variant="body">{text}</AppText>
    </Card>
  );
}
