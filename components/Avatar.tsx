import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { AVATAR_COLORS } from '../lib/constants';

interface AvatarProps {
  uri?: string | null;
  name?: string | null;
  color?: string | null;
  size?: number;
  ringColor?: string | null;
}

function getInitial(name?: string | null): string {
  if (!name) return '?';
  return name.trim()[0].toUpperCase();
}

function getDefaultColor(name?: string | null): string {
  if (!name) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function Avatar({ uri, name, color, size = 40, ringColor }: AvatarProps) {
  const bgColor = color || getDefaultColor(name);
  const initial = getInitial(name);
  const fontSize = Math.max(10, Math.floor(size * 0.4));

  if (ringColor) {
    return (
      <View
        style={[
          styles.ring,
          {
            width: size + 4,
            height: size + 4,
            borderRadius: (size + 4) / 2,
            borderColor: ringColor,
          },
        ]}
      >
        <AvatarInner uri={uri} bgColor={bgColor} initial={initial} size={size} fontSize={fontSize} />
      </View>
    );
  }

  return (
    <AvatarInner uri={uri} bgColor={bgColor} initial={initial} size={size} fontSize={fontSize} />
  );
}

function AvatarInner({
  uri,
  bgColor,
  initial,
  size,
  fontSize,
}: {
  uri?: string | null;
  bgColor: string;
  initial: string;
  size: number;
  fontSize: number;
}) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
        }}
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bgColor,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#FFFFFF', fontSize, fontWeight: '700' }}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
