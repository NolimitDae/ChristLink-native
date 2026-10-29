import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { AppText, Segmented } from '../../components/ui';
import { EventsTab } from '../../components/explore/EventsTab';
import { MapTab } from '../../components/explore/MapTab';
import { ChurchesTab } from '../../components/explore/ChurchesTab';
import { ServeTab } from '../../components/explore/ServeTab';
import { useTabBarClearance } from '../../components/TabBar';

type Tab = 'events' | 'map' | 'churches' | 'serve';

const TABS: { value: Tab; label: string }[] = [
  { value: 'events', label: 'Events' },
  { value: 'map', label: 'Map' },
  { value: 'churches', label: 'Churches' },
  { value: 'serve', label: 'Serve' },
];

function asTab(v?: string): Tab | null {
  return TABS.some(x => x.value === v) ? (v as Tab) : null;
}

export default function ExploreScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
    <View style={{ flex: 1, backgroundColor: t.c.bg, paddingTop: insets.top }}>
      <View style={{ paddingHorizontal: t.space.md, paddingTop: t.space.xs, paddingBottom: t.space.sm, gap: t.space.sm }}>
        <AppText variant="title1">Events</AppText>
        <Segmented options={TABS} value={tab} onChange={change} />
      </View>
      <View style={{ flex: 1 }}>
        {tab === 'events' ? <EventsTab initialType={params.type} bottomInset={listBottom} /> : null}
        {tab === 'map' ? <MapTab bottomInset={mapPreviewBottom} /> : null}
        {tab === 'churches' ? <ChurchesTab bottomInset={listBottom} /> : null}
        {tab === 'serve' ? <ServeTab bottomInset={listBottom} onFindChurch={() => change('churches')} /> : null}
      </View>
    </View>
  );
}
