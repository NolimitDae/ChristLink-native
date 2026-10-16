import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { Screen, Segmented } from '../../components/ui';
import { FeedView } from '../../components/community/FeedView';
import { PrayerWall } from '../../components/community/PrayerWall';

type CommunityView = 'feed' | 'prayer';

const OPTIONS: { value: CommunityView; label: string }[] = [
  { value: 'feed', label: 'Feed' },
  { value: 'prayer', label: 'Prayer Wall' },
];

export default function CommunityScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ view?: string }>();
  const [view, setView] = useState<CommunityView>(params.view === 'prayer' ? 'prayer' : 'feed');

  useEffect(() => {
    if (params.view === 'prayer' || params.view === 'feed') setView(params.view);
  }, [params.view]);

  const bottomPad = Math.max(120, insets.bottom + 100);

  return (
    <Screen title="Community">
      <View style={{ paddingHorizontal: t.space.md, paddingBottom: t.space.sm }}>
        <Segmented options={OPTIONS} value={view} onChange={setView} />
      </View>
      <View style={{ flex: 1 }}>{view === 'feed' ? <FeedView bottomPad={bottomPad} /> : <PrayerWall bottomPad={bottomPad} />}</View>
    </Screen>
  );
}
