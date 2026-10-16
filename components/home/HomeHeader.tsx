import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { firstName, greeting } from '../../lib/format';
import { Avatar } from '../Avatar';
import { AppText, IconButton } from '../ui';

export function HomeHeader() {
  const t = useTheme();
  const router = useRouter();
  const { session, profile } = useAuth();
  const first = firstName(profile?.full_name);
  const title = session ? `${greeting()}${first ? `, ${first}` : ''}` : 'Welcome';
  const dateLine = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <View style={[styles.row, { paddingHorizontal: t.space.md }]}>
      <View style={{ flex: 1 }}>
        <AppText variant="title1" numberOfLines={2}>
          {title}
        </AppText>
        <AppText variant="callout" tone="muted" style={{ marginTop: 2 }}>
          {dateLine}
        </AppText>
      </View>
      {session ? (
        <IconButton icon="notifications-outline" label="Notifications" onPress={() => router.push('/notifications')} />
      ) : null}
      <Pressable
        onPress={() => router.push(session ? '/profile' : '/auth')}
        accessibilityRole="button"
        accessibilityLabel={session ? 'Your profile' : 'Sign in'}
        hitSlop={4}
      >
        {session ? (
          <Avatar uri={profile?.avatar_url} name={profile?.full_name} color={profile?.avatar_color} size={38} ringColor={t.c.gold} />
        ) : (
          <View style={[styles.guest, { borderColor: t.c.gold, backgroundColor: t.c.surface2 }]}>
            <Ionicons name="person-outline" size={20} color={t.c.goldText} />
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  guest: { width: 46, height: 46, borderRadius: 23, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
