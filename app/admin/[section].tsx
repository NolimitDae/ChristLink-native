import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { EmptyState, Screen } from '../../components/ui';
import { AdminGate } from '../../components/admin/AdminGate';
import { ADMIN_SECTIONS, type AdminSection } from '../../components/admin/sections';
import { ReportsPanel } from '../../components/admin/ReportsPanel';
import { VerificationsPanel } from '../../components/admin/VerificationsPanel';
import { ChurchClaimsPanel } from '../../components/admin/ChurchClaimsPanel';
import { VersesPanel } from '../../components/admin/VersesPanel';
import { ToolsPanel } from '../../components/admin/ToolsPanel';
import { UsersPanel } from '../../components/admin/UsersPanel';
import { EventsPanel } from '../../components/admin/EventsPanel';
import { PromoCodesPanel } from '../../components/admin/PromoCodesPanel';
import { PayoutsPanel } from '../../components/admin/PayoutsPanel';
import { PostsPanel } from '../../components/admin/PostsPanel';

const PANELS: Record<AdminSection, () => React.JSX.Element> = {
  reports: ReportsPanel,
  verifications: VerificationsPanel,
  users: UsersPanel,
  events: EventsPanel,
  'promo-codes': PromoCodesPanel,
  payouts: PayoutsPanel,
  posts: PostsPanel,
  churches: ChurchClaimsPanel,
  verses: VersesPanel,
  tools: ToolsPanel,
};

export default function AdminSectionScreen() {
  const { section } = useLocalSearchParams<{ section: string }>();
  const meta = ADMIN_SECTIONS.find(s => s.key === section);
  const Panel = meta ? PANELS[meta.key] : null;
  return (
    <AdminGate>
      <Screen title={meta?.title ?? 'Admin'} back>
        {Panel ? <Panel /> : <EmptyState art="cross" title="Not found" body="This admin page doesn’t exist." />}
      </Screen>
    </AdminGate>
  );
}
