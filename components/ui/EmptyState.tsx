import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { AppText } from './AppText';
import { Button } from './Button';
import { LineArt, type LineArtName } from './LineArt';

interface EmptyStateProps {
  art: LineArtName;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}

export function EmptyState({ art, title, body, actionLabel, onAction, style, compact }: EmptyStateProps) {
  return (
    <View style={[styles.wrap, compact && styles.compact, style]}>
      <LineArt name={art} size={compact ? 72 : 104} />
      <AppText variant="title3" align="center" style={{ marginTop: 12 }}>
        {title}
      </AppText>
      {body ? (
        <AppText variant="callout" tone="muted" align="center" style={styles.body}>
          {body}
        </AppText>
      ) : null}
      {actionLabel && onAction ? <Button title={actionLabel} onPress={onAction} size="md" style={{ marginTop: 20 }} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 48 },
  compact: { paddingVertical: 24 },
  body: { marginTop: 6, maxWidth: 300 },
});
