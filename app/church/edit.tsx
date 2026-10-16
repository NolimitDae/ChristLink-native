import React, { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { AppText, Button, Card, EmptyState, Screen, Skeleton, SkeletonGroup } from '../../components/ui';
import { ChurchForm, toChurchPatch, type ChurchFormValues } from '../../components/church/ChurchForm';
import { RecurringManager } from '../../components/church/RecurringManager';
import { ClaimFlow } from '../../components/church/ClaimFlow';
import { withCoordinates } from '../../components/church/geocode';
import { errorMessage, isNotSetUp } from '../../components/church/churchFormat';
import { createChurch, getChurch, updateChurch } from '../../lib/features';
import { haptic } from '../../lib/haptics';
import type { Church } from '../../lib/types';

type Mode = 'choose' | 'claim' | 'create';
type EditLoad = { kind: 'loading' } | { kind: 'ready'; church: Church } | { kind: 'notFound' } | { kind: 'notSetUp' } | { kind: 'error'; message: string };

function PathCard({ icon, title, body, onPress }: { icon: 'search' | 'add-circle-outline'; title: string; body: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Card onPress={onPress} accessibilityLabel={title} style={styles.path}>
      <View style={[styles.pathIcon, { backgroundColor: t.c.goldDim, borderColor: t.c.goldHairline }]}>
        <Ionicons name={icon} size={22} color={t.c.goldText} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="headline">{title}</AppText>
        <AppText variant="callout" tone="muted">
          {body}
        </AppText>
      </View>
      <Ionicons name="chevron-forward" size={18} color={t.c.textFaint} />
    </Card>
  );
}

function FormSkeleton() {
  return (
    <SkeletonGroup label="Loading church">
      <View style={{ padding: 16, gap: 14 }}>
        <Skeleton width="30%" height={10} />
        <Skeleton height={50} radius={14} />
        <Skeleton height={50} radius={14} />
        <Skeleton height={104} radius={14} />
        <Skeleton width="30%" height={10} style={{ marginTop: 12 }} />
        <Skeleton height={50} radius={14} />
      </View>
    </SkeletonGroup>
  );
}

export default function ChurchEditScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session, user, isAdmin } = useAuth();
  const { showToast } = useToast();
  const [mode, setMode] = useState<Mode>('choose');
  const [load, setLoad] = useState<EditLoad>({ kind: 'loading' });

  const fetchChurch = useCallback(async () => {
    if (!id) return;
    setLoad({ kind: 'loading' });
    try {
      const church = await getChurch(id);
      setLoad(church ? { kind: 'ready', church } : { kind: 'notFound' });
    } catch (err) {
      setLoad(isNotSetUp(err) ? { kind: 'notSetUp' } : { kind: 'error', message: errorMessage(err) });
    }
  }, [id]);

  useEffect(() => {
    fetchChurch();
  }, [fetchChurch]);

  const scrollBody = (children: React.ReactNode) => (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ padding: t.space.md, paddingBottom: insets.bottom + t.space.xxl, gap: t.space.lg }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );

  if (!session || !user) {
    return (
      <Screen title="Your church" back>
        <EmptyState
          art="church"
          title="Sign in to manage a church page"
          body="Pastors and staff can claim or create their church’s page to share service times and events."
          actionLabel="Sign in"
          onAction={() => router.push('/auth')}
        />
      </Screen>
    );
  }

  if (id) {
    if (load.kind === 'loading') {
      return (
        <Screen title="Manage page" back>
          <FormSkeleton />
        </Screen>
      );
    }
    if (load.kind !== 'ready') {
      return (
        <Screen title="Manage page" back>
          <EmptyState
            art={load.kind === 'error' ? 'offline' : 'church'}
            title={load.kind === 'notSetUp' ? 'Church pages are coming soon' : load.kind === 'notFound' ? 'Church not found' : 'We couldn’t load this page'}
            body={load.kind === 'error' ? load.message : undefined}
            actionLabel={load.kind === 'error' ? 'Try again' : undefined}
            onAction={load.kind === 'error' ? fetchChurch : undefined}
          />
        </Screen>
      );
    }
    const church = load.church;
    if (church.claimed_by !== user.id && !isAdmin) {
      return (
        <Screen title="Manage page" back>
          <EmptyState
            art="church"
            title="You don’t manage this page"
            body={church.claimed_by ? 'Only the verified church admin can edit it.' : 'Claim this church to edit its page.'}
            actionLabel={church.claimed_by ? undefined : 'Claim a church'}
            onAction={church.claimed_by ? undefined : () => router.replace('/church/edit')}
          />
        </Screen>
      );
    }

    const save = async (v: ChurchFormValues) => {
      try {
        await updateChurch(church.id, await withCoordinates(toChurchPatch(v)));
        haptic.success();
        showToast('Church page updated', 'success');
        router.back();
      } catch (err) {
        showToast(errorMessage(err), 'error');
      }
    };

    return (
      <Screen title="Manage page" back>
        {scrollBody(
          <>
            {!church.verified ? (
              <Card variant="outline" style={styles.notice}>
                <Ionicons name="shield-outline" size={18} color={t.c.goldText} />
                <AppText variant="callout" tone="muted" style={{ flex: 1 }}>
                  Your page is live but unverified. Our team reviews new church pages and adds the verified check once confirmed.
                </AppText>
              </Card>
            ) : null}
            <ChurchForm initial={church} submitLabel="Save changes" onSubmit={save} />
            <View style={[styles.divider, { backgroundColor: t.c.goldHairline }]} />
            <RecurringManager churchId={church.id} />
          </>,
        )}
      </Screen>
    );
  }

  const create = async (v: ChurchFormValues) => {
    try {
      const patch = await withCoordinates(toChurchPatch(v));
      const church = await createChurch({ ...patch, claimed_by: user.id, verified: false });
      haptic.success();
      showToast('Your church page is live', 'success');
      router.replace(`/church/${church.id}`);
    } catch (err) {
      showToast(isNotSetUp(err) ? 'Church pages are coming soon.' : errorMessage(err), 'error');
    }
  };

  const title = mode === 'claim' ? 'Claim your church' : mode === 'create' ? 'New church page' : 'Your church';
  const backButton = mode === 'choose' ? undefined : (
    <Button title="Start over" variant="ghost" size="sm" onPress={() => setMode('choose')} />
  );

  return (
    <Screen title={title} back right={backButton}>
      {mode === 'choose'
        ? scrollBody(
            <>
              <AppText variant="body" tone="muted">
                Help your community find service times, events and ways to serve. Is your church already listed?
              </AppText>
              <PathCard icon="search" title="Find and claim" body="Your church is listed and you serve on staff or leadership." onPress={() => setMode('claim')} />
              <PathCard icon="add-circle-outline" title="Create a new church page" body="Not listed yet? Set it up in a couple of minutes." onPress={() => setMode('create')} />
            </>,
          )
        : mode === 'claim'
          ? scrollBody(<ClaimFlow onCreateInstead={() => setMode('create')} onDone={() => router.back()} />)
          : scrollBody(
              <>
                <Card variant="outline" style={styles.notice}>
                  <Ionicons name="shield-checkmark-outline" size={18} color={t.c.goldText} />
                  <AppText variant="callout" tone="muted" style={{ flex: 1 }}>
                    You’ll manage this page. It goes live right away and shows as unverified until our team confirms it with your church.
                  </AppText>
                </Card>
                <ChurchForm submitLabel="Create church page" onSubmit={create} />
              </>,
            )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  path: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  pathIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  divider: { height: StyleSheet.hairlineWidth * 2, marginVertical: 8 },
});
