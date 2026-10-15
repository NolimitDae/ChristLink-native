import React from 'react';
import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useTheme } from '../../contexts/ThemeContext';
import { formatDateLong, formatTimeRange } from '../../lib/format';
import { buildServeQr } from '../../lib/qr';
import type { ServeShift } from '../../lib/types';
import { AppText, Badge, Button, Card } from '../ui';
import { shiftPlace } from './ShiftCard';

/** QR codes need a white quiet zone to scan reliably in both themes, so the square is always white. */
const QR_BG = '#FFFFFF';
const QR_FG = '#14110E';

export function VolunteerPass({ shift, busy, onCancel }: { shift: ServeShift; busy?: boolean; onCancel: () => void }) {
  const t = useTheme();
  const code = shift.my_code ?? '';
  return (
    <Card variant="featured" padded={false} accessibilityLabel={`Volunteer pass for ${shift.role_name}`}>
      <View style={{ padding: t.space.md, gap: 4 }}>
        <View style={styles.row}>
          <AppText variant="overline" tone="gold" style={{ flex: 1 }}>
            Volunteer pass
          </AppText>
          {shift.my_status === 'checked_in' ? <Badge label="Checked in" tone="success" /> : null}
        </View>
        <AppText variant="title3" numberOfLines={2}>
          {shift.role_name}
        </AppText>
        <AppText variant="callout" tone="muted" numberOfLines={1}>
          {shiftPlace(shift)}
        </AppText>
        <AppText variant="callout">
          {formatDateLong(shift.starts_at)} · {formatTimeRange(shift.starts_at, shift.ends_at)}
        </AppText>
      </View>
      <View style={[styles.perf, { borderColor: t.c.goldHairline }]} />
      <View style={{ padding: t.space.md, alignItems: 'center', gap: t.space.sm }}>
        {code ? (
          <>
            <View style={[styles.qr, { borderRadius: t.radius.md }]} accessible accessibilityLabel="Check-in QR code">
              <QRCode value={buildServeQr(code)} size={164} backgroundColor={QR_BG} color={QR_FG} />
            </View>
            <AppText variant="headline" style={{ letterSpacing: 3 }} selectable>
              {code}
            </AppText>
            <AppText variant="caption" tone="muted">
              Show this at check-in
            </AppText>
          </>
        ) : null}
        <Button title="Cancel shift" variant="ghost" size="sm" onPress={onCancel} loading={busy} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qr: { backgroundColor: QR_BG, padding: 14 },
  perf: { borderTopWidth: 1.5, borderStyle: 'dashed', marginHorizontal: 16 },
});
