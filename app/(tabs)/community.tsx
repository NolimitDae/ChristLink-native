import React, { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { CollapsingHeader, Segmented } from '../../components/ui';
import { FeedView } from '../../components/community/FeedView';
import { PrayerWall } from '../../components/community/PrayerWall';
import { useTabBarClearance } from '../../components/TabBar';

type CommunityView = 'feed' | 'prayer';

const OPTIONS: { value: CommunityView; label: string }[] = [
  { value: 'feed', label: 'Feed' },
  { value: 'prayer', label: 'Prayer Wall' },
];

export default function CommunityScreen() {
  const params = useLocalSearchParams<{ view?: string }>();
  const [view, setView] = useState<CommunityView>(params.view === 'prayer' ? 'prayer' : 'feed');

  useEffect(() => {
    if (params.view === 'prayer' || params.view === 'feed') setView(params.view);
  }, [params.view]);

  const bottomPad = useTabBarClearance(24);

  return (
    <CollapsingHeader title="Community" resetKey={view} controls={<Segmented options={OPTIONS} value={view} onChange={setView} />}>
      {onScroll => (view === 'feed' ? <FeedView bottomPad={bottomPad} onScroll={onScroll} /> : <PrayerWall bottomPad={bottomPad} onScroll={onScroll} />)}
    </CollapsingHeader>
  );
}
