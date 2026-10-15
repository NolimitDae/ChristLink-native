import React, { useState } from 'react';
import { Image, Linking, Platform, Pressable, RefreshControl, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useAppData } from '../../contexts/AppDataContext';
import { useToast } from '../../contexts/ToastContext';
import { useReport } from '../../components/ReportSheet';
import { EventCard } from '../../components/EventCard';
import { AppText, BottomSheet, Button, EmptyState, IconButton, ListRow, Screen, Skeleton, SkeletonGroup } from '../../components/ui';
import { ChurchLogo, VerifiedMark } from '../../components/church/ChurchRow';
import { Leaders, RecurringList, Section, ServeHere, ServiceTimes } from '../../components/church/ChurchSections';
import { useChurchPage } from '../../components/church/useChurchPage';
import { errorMessage } from '../../components/church/churchFormat';
import { setFollowChurch, updateSettings } from '../../lib/features';
import { SITE_URL } from '../../lib/constants';
import { haptic } from '../../lib/haptics';
import type { Church } from '../../lib/types';

const HERO_H = 230;

function fullAddress(c: Church): string {
  return [c.address, c.city, [c.state, c.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
}

function ChurchSkeleton() {
  const t = useTheme();
  return (
    <SkeletonGroup label="Loading church">
      <Skeleton height={HERO_H} radius={0} />
      <View style={{ padding: t.space.md, gap: 12, marginTop: -40 }}>
        <Skeleton width={76} height={76} radius={22} />
        <Skeleton width="70%" height={26} />
        <Skeleton width="45%" height={14} />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
          <Skeleton width={120} height={44} radius={22} />
          <Skeleton width={120} height={44} radius={22} />
        </View>
        <Skeleton height={80} radius={20} style={{ marginTop: 16 }} />
        <Skeleton height={120} radius={20} />
      </View>
    </SkeletonGroup>
  );
}

export default function ChurchScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, user, isAdmin } = useAuth();
  const { settings, refreshSettings } = useAppData();
  const { showToast } = useToast();
  const report = useReport();
  const { state, recurring, events, shifts, following, setFollowing, reload } = useChurchPage(id);
  const [refreshing, setRefreshing] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [homeBusy, setHomeBusy] = useState(false);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/explore?tab=churches'));

  if (state.kind === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: t.c.bg }}>
        <ChurchSkeleton />
        <View style={[styles.topButtons, { top: insets.top + 8 }]}>
          <IconButton icon="chevron-back" label="Back" tone="glass" onPress={back} />
        </View>
      </View>
    );
  }

  if (state.kind !== 'ready') {
    const copy =
      state.kind === 'notSetUp'
        ? { art: 'church' as const, title: 'Church pages are coming soon', body: 'We’re putting the finishing touches on church pages.' }
        : state.kind === 'notFound'
          ? { art: 'church' as const, title: 'Church not found', body: 'This page may have been removed or the link is incorrect.' }
          : { art: 'offline' as const, title: 'We couldn’t load this church', body: state.message };
    return (
      <Screen back>
        <EmptyState
          art={copy.art}
          title={copy.title}
          body={copy.body}
          actionLabel={state.kind === 'error' ? 'Try again' : 'Browse churches'}
          onAction={state.kind === 'error' ? reload : () => router.replace('/(tabs)/explore?tab=churches')}
        />
      </Screen>
    );
  }

  const church = state.church;
  const isHome = settings?.home_church_id === church.id;
  const canManage = !!user && (user.id === church.claimed_by || isAdmin);
  const address = fullAddress(church);
  const shareUrl = `${SITE_URL}/church/${church.id}`;

  const requireAuth = (): boolean => {
    if (session) return true;
    router.push('/auth');
    return false;
  };

  const toggleFollow = async () => {
    if (!requireAuth()) return;
    const next = !following;
    setFollowing(next);
    setFollowBusy(true);
    try {
      await setFollowChurch(church.id, next);
      haptic.light();
      if (next) showToast(`Following ${church.name}`, 'success');
    } catch (err) {
      setFollowing(!next);
      showToast(errorMessage(err), 'error');
    } finally {
      setFollowBusy(false);
    }
  };

  const makeHome = async () => {
    if (!requireAuth()) return;
    setHomeBusy(true);
    try {
      await updateSettings({ home_church_id: church.id });
      await refreshSettings();
      haptic.success();
      showToast(`${church.name} is now your Home Church`, 'success');
    } catch (err) {
      showToast(errorMessage(err), 'error');
    } finally {
      setHomeBusy(false);
    }
  };

  const openMaps = () => {
    const q = encodeURIComponent(address || church.name);
    const url = Platform.OS === 'ios' ? `https://maps.apple.com/?q=${q}` : `geo:0,0?q=${q}`;
    Linking.openURL(url).catch(() => showToast('Couldn’t open maps on this device', 'error'));
  };

  const openWeb = (url: string) => {
    WebBrowser.openBrowserAsync(url, { controlsColor: t.c.gold }).catch(() => showToast('Couldn’t open that link', 'error'));
  };

  const share = () => {
    setMoreOpen(false);
    Share.share({ message: `${church.name} on Christ Link Social\n${shareUrl}`, url: shareUrl }).catch(() => undefined);
  };

  const subline = [church.denomination, [church.city, church.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ');

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + t.space.xxl }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await reload();
              setRefreshing(false);
            }}
            tintColor={t.c.gold}
            colors={[t.c.gold]}
            progressViewOffset={insets.top}
          />
        }
      >
        <View style={{ height: HERO_H + insets.top, backgroundColor: t.c.surface2 }}>
          {church.photos?.[0] ? (
            <Image source={{ uri: church.photos[0] }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
          ) : (
            <LinearGradient colors={[t.c.goldDim, t.c.surface2, t.c.bg]} style={StyleSheet.absoluteFill} />
          )}
          <LinearGradient colors={['rgba(14,12,10,0.35)', 'transparent', t.c.bg]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
        </View>

        <View style={{ paddingHorizontal: t.space.md, marginTop: -48, gap: t.space.lg }}>
          <View style={{ gap: 8 }}>
            <View style={[styles.logoRing, { borderColor: t.c.bg, borderRadius: 26 }]}>
              <ChurchLogo church={church} size={76} />
            </View>
            <View style={styles.nameRow}>
              <AppText variant="title1" style={{ flexShrink: 1 }}>
                {church.name}
              </AppText>
              {church.verified ? <VerifiedMark size={22} /> : null}
            </View>
            {subline ? (
              <AppText variant="callout" tone="muted">
                {subline}
                {church.verified ? '' : ' · Unverified'}
              </AppText>
            ) : null}
            {address ? (
              <Pressable onPress={openMaps} accessibilityRole="link" accessibilityLabel={`Address: ${address}. Opens maps`} hitSlop={6} style={styles.address}>
                <Ionicons name="location-outline" size={16} color={t.c.goldText} />
                <AppText variant="callout" tone="gold" style={{ flexShrink: 1, textDecorationLine: 'underline' }}>
                  {address}
                </AppText>
              </Pressable>
            ) : null}
          </View>

          <View style={{ gap: 10 }}>
            <View style={styles.actions}>
              <Button
                title={following ? 'Following' : 'Follow'}
                icon={following ? 'checkmark' : 'add'}
                variant={following ? 'secondary' : 'primary'}
                onPress={toggleFollow}
                loading={followBusy}
                style={{ flex: 1 }}
              />
              {church.livestream_url ? (
                <Button title="Livestream" icon="play-circle-outline" variant="secondary" onPress={() => openWeb(church.livestream_url as string)} style={{ flex: 1 }} />
              ) : null}
              <IconButton icon="share-outline" label="Share church page" size={48} onPress={share} />
            </View>
            {isHome ? (
              <View style={[styles.homeBadge, { backgroundColor: t.c.goldDim, borderColor: t.c.goldHairline, borderRadius: t.radius.pill }]} accessible accessibilityLabel="This is your Home Church">
                <Ionicons name="home" size={16} color={t.c.goldText} />
                <AppText variant="bodyStrong" tone="gold">
                  Your Home Church
                </AppText>
              </View>
            ) : (
              <Button title="Make this my Home Church" icon="home-outline" variant="secondary" onPress={makeHome} loading={homeBusy} fullWidth />
            )}
            {canManage ? (
              <Button title="Manage page" icon="create-outline" variant="ghost" onPress={() => router.push(`/church/edit?id=${church.id}`)} fullWidth />
            ) : null}
          </View>

          <ServiceTimes church={church} recurring={recurring} />
          <RecurringList recurring={recurring} />

          <Section title="Upcoming events">
            {events === null ? (
              <View style={{ gap: 10 }}>
                <Skeleton height={96} radius={20} />
                <Skeleton height={96} radius={20} />
              </View>
            ) : events.length === 0 ? (
              <AppText variant="callout" tone="muted">
                No upcoming events listed yet. Follow to hear when something new is posted.
              </AppText>
            ) : (
              <View style={{ gap: 10 }}>
                {events.slice(0, 6).map(e => (
                  <EventCard key={e.id} event={e} variant="row" />
                ))}
              </View>
            )}
          </Section>

          <Leaders leaders={church.leaders} />

          {church.about ? (
            <Section title="About">
              <AppText variant="body" tone="muted">
                {church.about}
              </AppText>
              {church.website_url ? (
                <Button title="Visit website" icon="globe-outline" variant="ghost" size="sm" onPress={() => openWeb(church.website_url as string)} style={{ alignSelf: 'flex-start' }} />
              ) : null}
            </Section>
          ) : null}

          <ServeHere shifts={shifts} onOpen={() => router.push('/(tabs)/explore?tab=serve')} />
        </View>
      </ScrollView>

      <View style={[styles.topButtons, { top: insets.top + 8 }]} pointerEvents="box-none">
        <IconButton icon="chevron-back" label="Back" tone="glass" onPress={back} />
        <IconButton icon="ellipsis-horizontal" label="More options" tone="glass" onPress={() => setMoreOpen(true)} />
      </View>

      <BottomSheet visible={moreOpen} onClose={() => setMoreOpen(false)} title={church.name}>
        <ListRow icon="share-outline" title="Share this page" onPress={share} />
        {church.website_url ? (
          <ListRow
            icon="globe-outline"
            title="Open website"
            onPress={() => {
              setMoreOpen(false);
              openWeb(church.website_url as string);
            }}
          />
        ) : null}
        {!canManage && !church.claimed_by ? (
          <ListRow
            icon="shield-checkmark-outline"
            title="Claim this church"
            subtitle="For pastors and staff"
            onPress={() => {
              setMoreOpen(false);
              router.push(session ? '/church/edit' : '/auth');
            }}
          />
        ) : null}
        <ListRow
          icon="flag-outline"
          title="Report this page"
          destructive
          last
          onPress={() => {
            setMoreOpen(false);
            report.open({ type: 'church', id: church.id, authorId: church.claimed_by, authorName: church.name });
          }}
        />
      </BottomSheet>
      {report.sheet}
    </View>
  );
}

const styles = StyleSheet.create({
  topButtons: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  logoRing: { alignSelf: 'flex-start', borderWidth: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  address: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  homeBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48, borderWidth: 1 },
});
