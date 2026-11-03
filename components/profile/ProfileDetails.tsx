import React from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { CONNECT_OPTIONS, HOBBIES, parseHobbies } from '../../lib/profileOptions';
import type { Profile } from '../../lib/types';
import { AppIcon, type AppIconName } from '../icons/AppIcon';
import { AppText, Card, PressScale, SectionHeader } from '../ui';

type Pill = { key: string; label: string; icon: AppIconName };

function Pills({ items }: { items: Pill[] }) {
  const t = useTheme();
  return (
    <View style={[styles.pills, { paddingHorizontal: t.space.md }]}>
      {items.map(i => (
        <View key={i.key} style={[styles.pill, { backgroundColor: t.c.surface, borderColor: t.c.border, borderRadius: t.radius.pill }]}>
          <AppIcon name={i.icon} size={15} color={t.c.goldText} />
          <AppText variant="caption" style={{ fontSize: 13 }}>
            {i.label}
          </AppText>
        </View>
      ))}
    </View>
  );
}

function StoryCard({ icon, title, text }: { icon: AppIconName; title: string; text: string }) {
  const t = useTheme();
  return (
    <Card style={{ marginHorizontal: t.space.md, gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <AppIcon name={icon} size={14} color={t.c.goldText} />
        <AppText variant="label" tone="gold">
          {title}
        </AppText>
      </View>
      <AppText variant="body">{text}</AppText>
    </Card>
  );
}

const SOCIALS = [
  { key: 'instagram_url', label: 'Instagram', icon: 'logo-instagram' },
  { key: 'facebook_url', label: 'Facebook', icon: 'logo-facebook' },
  { key: 'tiktok_url', label: 'TikTok', icon: 'logo-tiktok' },
] as const;

/**
 * What someone shared about themselves in Edit Profile: open to connect, hobbies, testimony, hot takes and socials.
 * Sections without content are left out. Same fields and labels as the website.
 */
export function ProfileDetails({ profile }: { profile: Profile }) {
  const t = useTheme();
  const name = (profile.full_name ?? '').trim().split(/\s+/)[0] || 'They';

  const connect: Pill[] = (profile.connect_tags ?? []).flatMap(id => {
    const o = CONNECT_OPTIONS.find(c => c.id === id);
    return o ? [{ key: o.id, label: o.label, icon: o.icon }] : [];
  });
  const hobbies: Pill[] = parseHobbies(profile.hobbies).map(h => ({
    key: h,
    label: h,
    icon: HOBBIES.find(x => x.label === h)?.icon ?? 'star-outline',
  }));
  const socials = SOCIALS.filter(s => !!profile[s.key]);

  return (
    <>
      {connect.length > 0 ? (
        <View>
          <SectionHeader title="Open to" />
          <Pills items={connect} />
        </View>
      ) : null}

      {hobbies.length > 0 ? (
        <View>
          <SectionHeader title="Hobbies" />
          <Pills items={hobbies} />
        </View>
      ) : null}

      {profile.testimony?.trim() ? <StoryCard icon="checkmark-done-outline" title={`${name}’s testimony`} text={profile.testimony.trim()} /> : null}
      {profile.hot_takes?.trim() ? <StoryCard icon="chatbubble-ellipses-outline" title="Hot takes" text={profile.hot_takes.trim()} /> : null}

      {socials.length > 0 ? (
        <View style={[styles.socials, { paddingHorizontal: t.space.md }]}>
          {socials.map(s => (
            <PressScale
              key={s.key}
              onPress={() => Linking.openURL(profile[s.key] as string).catch(() => undefined)}
              accessibilityRole="link"
              accessibilityLabel={`${name} on ${s.label}`}
              scaleTo={0.95}
              style={[styles.social, { backgroundColor: t.c.surface, borderColor: t.c.border, borderRadius: t.radius.pill }]}
            >
              <Ionicons name={s.icon} size={18} color={t.c.text} />
              <AppText variant="caption" style={{ fontSize: 13 }}>
                {s.label}
              </AppText>
            </PressScale>
          ))}
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, minHeight: 34, borderWidth: 1 },
  socials: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  social: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, minHeight: 44, borderWidth: 1 },
});
