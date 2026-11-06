import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CollapsingHeader, Segmented } from '../../components/ui';
import { EventsTab } from '../../components/explore/EventsTab';
import { MapTab } from '../../components/explore/MapTab';
import { ChurchesTab } from '../../components/explore/ChurchesTab';
import { ServeTab } from '../../components/explore/ServeTab';
import { useTabBarClearance } from '../../components/TabBar';

type Tab = 'events' | 'map' | 'churches' | 'serve';

const ALL_TABS: { value: Tab; label: string }[] = [
  { value: 'events', label: 'Events' },
  { value: 'map', label: 'Map' },
  { value: 'churches', label: 'Churches' },
  { value: 'serve', label: 'Serve' },
];
// Maps need the phone app (react-native-maps has no web version)
const TABS = Platform.OS === 'web' ? ALL_TABS.filter(x => x.value !== 'map') : ALL_TABS;

function asTab(v?: string): Tab | null {
  return TABS.some(x => x.value === v) ? (v as Tab) : null;
}

export default function ExploreScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string; type?: string }>();
  const [tab, setTab] = useState<Tab>(asTab(params.tab) ?? 'events');

  useEffect(() => {
    const next = asTab(params.tab);
    if (next) setTab(next);
  }, [params.tab]);

  const change = (next: Tab) => {
    setTab(next);
    router.setParams({ tab: next });
  };

  const barClearance = useTabBarClearance();
  const listBottom = barClearance + 36;
  const mapPreviewBottom = barClearance;

  return (
    <CollapsingHeader title="Events" resetKey={tab} controls={<Segmented options={TABS} value={tab} onChange={change} />}>
      {onScroll => (
        <>
          {tab === 'events' ? <EventsTab initialType={params.type} bottomInset={listBottom} onScroll={onScroll} /> : null}
          {tab === 'map' ? <MapTab bottomInset={mapPreviewBottom} /> : null}
          {tab === 'churches' ? <ChurchesTab bottomInset={listBottom} onScroll={onScroll} /> : null}
          {tab === 'serve' ? <ServeTab bottomInset={listBottom} onFindChurch={() => change('churches')} onScroll={onScroll} /> : null}
        </>
      )}
    </CollapsingHeader>
  );
}
