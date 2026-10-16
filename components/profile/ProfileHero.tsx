import React from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { makeStyles, useTheme } from '../../contexts/ThemeContext';
import type { Profile } from '../../lib/types';
import { Avatar } from '../Avatar';
import { AppText } from '../ui';

const BANNER_H = 150;
const AVATAR = 96;

export function isVerifiedProfile(p: Pick<Profile, 'identity_verified' | 'role'>): boolean {
  return !!p.identity_verified || p.role === 'verified' || p.role === 'admin';
}

interface ProfileHeroProps {
  profile: Profile;
  editable?: boolean;
  onPickBanner?: () => void;
  onPickAvatar?: () => void;
  uploading?: 'banner' | 'avatar' | null;
  right?: React.ReactNode;
}

export function ProfileHero({ profile, editable, onPickBanner, onPickAvatar, uploading, right }: ProfileHeroProps) {
  const t = useTheme();
  const s = useStyles();

  const banner = (
    <View style={s.banner}>
      {profile.banner_url ? (
        <Image source={{ uri: profile.banner_url }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
      ) : (
        <LinearGradient colors={[t.c.goldHairline, t.c.goldDim, t.c.surface2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      )}
      {editable ? (
        <View style={s.bannerEdit}>
          {uploading === 'banner' ? <ActivityIndicator color="#F6EFE3" size="small" /> : <Ionicons name="camera-outline" size={16} color="#F6EFE3" />}
        </View>
      ) : null}
    </View>
  );

  return (
    <View>
      {editable ? (
        <Pressable onPress={onPickBanner} disabled={!!uploading} accessibilityRole="button" accessibilityLabel="Change banner photo">
          {banner}
        </Pressable>
      ) : (
        banner
      )}
      <View style={s.row}>
        <Pressable
          onPress={onPickAvatar}
          disabled={!editable || !!uploading}
          accessibilityRole={editable ? 'button' : 'image'}
          accessibilityLabel={editable ? 'Change profile photo' : `${profile.full_name}'s photo`}
          style={s.avatarWrap}
        >
          <Avatar uri={profile.avatar_url} name={profile.full_name} color={profile.avatar_color} size={AVATAR} ringColor={t.c.gold} ringWidth={3} />
          {editable ? (
            <View style={s.avatarEdit}>
              {uploading === 'avatar' ? <ActivityIndicator color={t.c.onGold} size="small" /> : <Ionicons name="camera" size={14} color={t.c.onGold} />}
            </View>
          ) : null}
        </Pressable>
        <View style={{ flex: 1 }} />
        {right}
      </View>
      <View style={s.text}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <AppText variant="title1" numberOfLines={2} style={{ flexShrink: 1 }}>
            {profile.full_name || 'Your name'}
          </AppText>
          {isVerifiedProfile(profile) ? <Ionicons name="checkmark-circle" size={20} color={t.c.goldText} accessibilityLabel="Verified" /> : null}
        </View>
        {profile.city ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <Ionicons name="location-outline" size={14} color={t.c.textMuted} />
            <AppText variant="callout" tone="muted">
              {profile.city}
            </AppText>
          </View>
        ) : null}
        {profile.bio ? (
          <AppText variant="body" style={{ marginTop: t.space.xs }}>
            {profile.bio}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const useStyles = makeStyles(t => ({
  banner: {
    height: BANNER_H,
    marginHorizontal: t.space.md,
    borderRadius: t.radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: t.c.border,
    backgroundColor: t.c.surface2,
  },
  bannerEdit: {
    position: 'absolute',
    right: 10,
    top: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(14,12,10,0.55)',
  },
  row: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: t.space.lg, marginTop: -AVATAR / 2, gap: t.space.xs },
  avatarWrap: { borderRadius: AVATAR, backgroundColor: t.c.bg, padding: 2 },
  avatarEdit: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.c.gold,
    borderWidth: 2,
    borderColor: t.c.bg,
  },
  text: { paddingHorizontal: t.space.md, marginTop: t.space.sm },
}));
