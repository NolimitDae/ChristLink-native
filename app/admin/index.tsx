import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { EmptyState, Screen, Segmented } from '../../components/ui';
import { ReportsPanel } from '../../components/admin/ReportsPanel';
import { VerificationsPanel } from '../../components/admin/VerificationsPanel';
import { ChurchClaimsPanel } from '../../components/admin/ChurchClaimsPanel';
import { VersesPanel } from '../../components/admin/VersesPanel';
import { ToolsPanel } from '../../components/admin/ToolsPanel';

type Tab = 'reports' | 'verifications' | 'churches' | 'verses' | 'tools';

const TABS: { value: Tab; label: string }[] = [
  { value: 'reports', label: 'Reports' },
  { value: 'verifications', label: 'Verify' },
  { value: 'churches', label: 'Churches' },
  { value: 'verses', label: 'Verses' },
  { value: 'tools', label: 'Tools' },
];

export default function AdminScreen() {
  const t = useTheme();
  const router = useRouter();
  const { isAdmin, loading } = useAuth();
  const [tab, setTab] = useState<Tab>('reports');

  if (!isAdmin) {
    return (
      <Screen title="Admin" back>
        {loading ? null : (
          <EmptyState art="cross" title="Admins only" body="This area is for the Christ Link Social team." actionLabel="Go back" onAction={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} />
        )}
      </Screen>
    );
  }

  return (
    <Screen title="Admin" back>
      <View style={{ paddingHorizontal: t.space.md, paddingBottom: t.space.xs }}>
        <Segmented options={TABS} value={tab} onChange={setTab} />
      </View>
      <View style={{ flex: 1 }}>
        {tab === 'reports' ? <ReportsPanel /> : null}
        {tab === 'verifications' ? <VerificationsPanel /> : null}
        {tab === 'churches' ? <ChurchClaimsPanel /> : null}
        {tab === 'verses' ? <VersesPanel /> : null}
        {tab === 'tools' ? <ToolsPanel /> : null}
      </View>
    </Screen>
  );
}
