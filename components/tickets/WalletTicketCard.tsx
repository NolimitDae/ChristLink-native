import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { formatDateShort, formatTimeRange } from '../../lib/format';
import { AppText } from '../ui/AppText';
import { TicketShell } from '../ui/Card';
import { CountdownChip } from './CountdownChip';
import type { WalletItem } from './walletItems';

export const WALLET_CARD_HEIGHT = 228;
export const MONO_FONT = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

/** Wallet pass: the header row (type, name, countdown) is what shows while the card is stacked. */
export function WalletTicketCard({ item }: { item: WalletItem }) {
  const t = useTheme();
  const isRsvp = item.kind === 'rsvp';
  const time = formatTimeRange(item.start, item.end);
  return (
    <TicketShell
      notchAt={0.64}
      style={{ height: WALLET_CARD_HEIGHT }}
      top={
        <View style={styles.top}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <AppText variant="overline" tone="gold" style={{ fontSize: 10 }}>
                {isRsvp ? 'RSVP' : item.checkedIn ? 'Checked in' : 'Ticket'}
              </AppText>
              <AppText variant="title3" numberOfLines={1}>
                {item.name}
              </AppText>
            </View>
            <CountdownChip start={item.start} end={item.end} />
          </View>
          <View style={{ gap: 4 }}>
            <View style={styles.meta}>
              <Ionicons name="calendar-outline" size={14} color={t.c.textMuted} />
              <AppText variant="callout" tone="muted" numberOfLines={1} style={{ flex: 1 }}>
                {formatDateShort(item.start)}
                {time ? ` · ${time}` : ''}
              </AppText>
            </View>
            {item.venue ? (
              <View style={styles.meta}>
                <Ionicons name="location-outline" size={14} color={t.c.textMuted} />
                <AppText variant="callout" tone="muted" numberOfLines={1} style={{ flex: 1 }}>
                  {item.venue}
                </AppText>
              </View>
            ) : null}
          </View>
        </View>
      }
      bottom={
        <View style={styles.bottom}>
          <View style={{ flex: 1 }}>
            <AppText variant="caption" tone="faint" style={{ fontSize: 11 }}>
              {isRsvp ? 'Admission' : 'Ticket type'}
            </AppText>
            <AppText variant="bodyStrong" numberOfLines={1}>
              {isRsvp ? 'RSVP · Free' : `${item.typeName} × ${item.qty}`}
            </AppText>
          </View>
          {isRsvp ? (
            <Ionicons name="arrow-forward-circle-outline" size={26} color={t.c.goldText} />
          ) : (
            <View style={styles.codeWrap}>
              <AppText variant="bodyStrong" tone="gold" style={{ fontFamily: MONO_FONT, letterSpacing: 1.5 }}>
                {item.code}
              </AppText>
              <Ionicons name="qr-code-outline" size={22} color={t.c.goldText} />
            </View>
          )}
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  top: { flex: 1, paddingHorizontal: 16, paddingTop: 14, justifyContent: 'space-between', paddingBottom: 4 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bottom: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12, paddingBottom: 4 },
  codeWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
