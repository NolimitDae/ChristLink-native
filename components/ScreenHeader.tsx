import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from './Avatar';
import { useAuth } from '../contexts/AuthContext';
import { COLORS } from '../lib/constants';

interface ScreenHeaderProps {
  title?: string;
  showLogo?: boolean;
  showBack?: boolean;
  rightElement?: React.ReactNode;
}

const C = COLORS.dark;

export function ScreenHeader({ title, showLogo = false, showBack = false, rightElement }: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useAuth();

  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <View style={styles.row}>
        {/* Left */}
        {showBack ? (
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={24} color={C.text} />
          </TouchableOpacity>
        ) : showLogo ? (
          <Text style={styles.logoText}>ChristLink</Text>
        ) : (
          <Text style={styles.title}>{title ?? ''}</Text>
        )}

        {/* Spacer */}
        <View style={{ flex: 1 }} />

        {/* Right */}
        {rightElement ? (
          rightElement
        ) : (
          <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}>
            <Avatar
              uri={profile?.avatar_url}
              name={profile?.full_name}
              color={profile?.avatar_color}
              size={34}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: C.bg,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 40,
  },
  logoText: {
    color: C.gold,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  title: {
    color: C.text,
    fontSize: 18,
    fontWeight: '700',
  },
  iconBtn: {
    padding: 4,
    marginLeft: -4,
  },
});
