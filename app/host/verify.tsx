import React, { useCallback, useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { makeStyles, useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getIdentityStatus, submitIdentity } from '../../lib/api';
import { formatDateLong } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import type { IdentityStatus } from '../../lib/types';
import { AppText, Badge, Button, Card, EmptyState, Field, Screen, Skeleton, SkeletonGroup } from '../../components/ui';
import { errorMessage } from '../../components/host/errors';
import { pickImage, PickError, type PickedImage } from '../../components/host/pickImage';

const STATUS_UI: Record<IdentityStatus['status'], { label: string; tone: 'neutral' | 'gold' | 'success' | 'danger'; icon: React.ComponentProps<typeof Ionicons>['name']; title: string; body: string }> = {
  none: { label: 'Not submitted', tone: 'neutral', icon: 'id-card-outline', title: 'Verify your identity', body: 'Hosts of paid events confirm who they are. It protects attendees and keeps scammers out.' },
  pending: { label: 'In review', tone: 'gold', icon: 'hourglass-outline', title: 'We’re reviewing your ID', body: 'Most reviews finish within one business day. We’ll notify you when it’s done.' },
  approved: { label: 'Verified', tone: 'success', icon: 'shield-checkmark', title: 'You’re verified', body: 'Your profile shows a verified host badge and you can publish paid events.' },
  rejected: { label: 'Not approved', tone: 'danger', icon: 'alert-circle-outline', title: 'We couldn’t verify your ID', body: 'Please submit again with a clear photo of a valid government ID.' },
};

export default function VerifyScreen() {
  const t = useTheme();
  const s = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, profile, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const token = session?.access_token;

  const [status, setStatus] = useState<IdentityStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [legalName, setLegalName] = useState('');
  const [photo, setPhoto] = useState<PickedImage | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      setStatus(await getIdentityStatus(token));
    } catch {
      setStatus({ status: 'none' });
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!legalName && (status?.legal_name || profile?.full_name)) setLegalName(status?.legal_name ?? profile?.full_name ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.legal_name, profile?.full_name]);

  const choose = async (source: 'camera' | 'library') => {
    setPhotoError(null);
    try {
      const img = await pickImage({ source, quality: 0.7, maxBytes: 10 * 1024 * 1024 });
      if (img) setPhoto(img);
    } catch (err) {
      setPhotoError(err instanceof PickError ? err.message : errorMessage(err, 'Could not open the photo'));
    }
  };

  const submit = async () => {
    const name = legalName.trim();
    let ok = true;
    if (name.length < 3 || !name.includes(' ')) {
      setNameError('Enter your full legal name as it appears on your ID');
      ok = false;
    }
    if (!photo) {
      setPhotoError('Add a photo of your ID');
      ok = false;
    }
    if (!ok || !photo || !token) {
      haptic.warning();
      return;
    }
    setSubmitting(true);
    try {
      await submitIdentity(name, photo.dataUrl, token);
      haptic.success();
      showToast('Submitted for review', 'success');
      setPhoto(null);
      await Promise.all([load(), refreshProfile()]);
    } catch (err) {
      haptic.error();
      showToast(errorMessage(err, 'Upload failed. Please try again.'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!session) {
    return (
      <Screen title="Verify identity" back>
        <EmptyState art="people" title="Sign in to verify" actionLabel="Sign in" onAction={() => router.push('/auth')} />
      </Screen>
    );
  }

  const current: IdentityStatus['status'] = profile?.identity_verified ? 'approved' : status?.status ?? 'none';
  const ui = STATUS_UI[current];
  const showForm = !loading && (current === 'none' || current === 'rejected');

  return (
    <Screen title="Verify identity" back>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: t.space.md, paddingBottom: insets.bottom + t.space.xxl, gap: t.space.md }}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await Promise.all([load(), refreshProfile()]);
                setRefreshing(false);
              }}
              tintColor={t.c.gold}
              colors={[t.c.gold]}
            />
          }
        >
          {loading ? (
            <SkeletonGroup>
              <Skeleton height={150} radius={t.radius.lg} />
            </SkeletonGroup>
          ) : (
            <Card variant={current === 'approved' ? 'standard' : 'featured'} style={[{ gap: t.space.sm }, current === 'approved' ? { borderColor: t.c.success } : current === 'rejected' ? { borderColor: t.c.danger } : null]}>
              <View style={s.statusTop}>
                <View style={[s.statusIcon, { backgroundColor: current === 'approved' ? t.c.successDim : current === 'rejected' ? t.c.dangerDim : t.c.goldDim }]}>
                  <Ionicons name={ui.icon} size={22} color={current === 'approved' ? t.c.success : current === 'rejected' ? t.c.danger : t.c.goldText} />
                </View>
                <Badge label={ui.label} tone={ui.tone} />
              </View>
              <AppText variant="title2">{ui.title}</AppText>
              <AppText variant="callout" tone="muted">
                {ui.body}
              </AppText>
              {current === 'rejected' && status?.rejection_reason ? (
                <View style={s.reason}>
                  <AppText variant="caption" tone="danger">
                    Reason: {status.rejection_reason}
                  </AppText>
                </View>
              ) : null}
              {current === 'pending' && status?.submitted_at ? (
                <AppText variant="caption" tone="faint">
                  Submitted {formatDateLong(status.submitted_at)}
                </AppText>
              ) : null}
              {current === 'approved' ? <Button title="Back to hosting" variant="secondary" onPress={() => router.back()} /> : null}
            </Card>
          )}

          {showForm ? (
            <>
              <Field
                label="Full legal name"
                value={legalName}
                onChangeText={v => {
                  setLegalName(v);
                  setNameError(null);
                }}
                autoComplete="name"
                textContentType="name"
                autoCapitalize="words"
                error={nameError}
                hint="Exactly as it appears on your ID"
              />

              <View style={{ gap: t.space.xs }}>
                <AppText variant="caption" tone="muted" style={{ fontSize: 13 }}>
                  Government ID
                </AppText>
                {photo ? (
                  <View style={s.preview}>
                    <Image source={{ uri: photo.uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" accessibilityLabel="ID photo preview" />
                  </View>
                ) : (
                  <View style={[s.preview, s.previewEmpty, photoError ? { borderColor: t.c.danger } : null]}>
                    <Ionicons name="id-card-outline" size={36} color={t.c.goldText} />
                    <AppText variant="callout" tone="muted" align="center">
                      Driver’s license, passport or state ID.{'\n'}All four corners visible, no glare.
                    </AppText>
                  </View>
                )}
                <View style={{ flexDirection: 'row', gap: t.space.xs }}>
                  <Button title="Take photo" icon="camera-outline" variant="secondary" onPress={() => choose('camera')} style={{ flex: 1 }} fullWidth />
                  <Button title="Choose photo" icon="images-outline" variant="secondary" onPress={() => choose('library')} style={{ flex: 1 }} fullWidth />
                </View>
                {photoError ? (
                  <AppText variant="caption" tone="danger" accessibilityLiveRegion="polite">
                    {photoError}
                  </AppText>
                ) : null}
              </View>

              <View style={s.privacy}>
                <Ionicons name="lock-closed-outline" size={18} color={t.c.goldText} />
                <AppText variant="caption" tone="muted" style={{ flex: 1 }}>
                  Your ID is stored privately, only reviewed by our team, and deleted 30 days after a decision.
                </AppText>
              </View>

              <Button title="Submit for review" size="lg" fullWidth onPress={submit} loading={submitting} />
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const useStyles = makeStyles(t => ({
  statusTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  reason: { backgroundColor: t.c.dangerDim, borderRadius: t.radius.sm, padding: t.space.sm },
  preview: { aspectRatio: 1.586, borderRadius: t.radius.lg, overflow: 'hidden', backgroundColor: t.c.surface, borderWidth: 1, borderColor: t.c.border },
  previewEmpty: { alignItems: 'center', justifyContent: 'center', gap: t.space.xs, borderStyle: 'dashed', borderWidth: 1.5, borderColor: t.c.goldHairline, padding: t.space.md },
  privacy: { flexDirection: 'row', gap: t.space.xs, alignItems: 'flex-start', padding: t.space.sm, borderRadius: t.radius.md, backgroundColor: t.c.goldDim },
}));
