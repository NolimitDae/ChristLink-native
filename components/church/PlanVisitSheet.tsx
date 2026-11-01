import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { addToCalendar } from '../../lib/calendar';
import { openInMaps } from '../../lib/maps';
import { scheduleReminders } from '../../lib/notifications';
import { haptic } from '../../lib/haptics';
import type { Church } from '../../lib/types';
import { AppText, BottomSheet, Button } from '../ui';
import type { ScheduleItem } from './churchFormat';

interface PlanVisitSheetProps {
  visible: boolean;
  onClose: () => void;
  church: Church;
  address: string;
  options: ScheduleItem[];
  shareUrl: string;
}

const SERVICE_MINUTES = 90;

function whenLabel(d: Date): string {
  const day = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time}`;
}

/** First-time visitors pick a service, then save it to their calendar (with a reminder the day before) and get directions. */
export function PlanVisitSheet({ visible, onClose, church, address, options, shareUrl }: PlanVisitSheetProps) {
  const t = useTheme();
  const { showToast } = useToast();
  const [selected, setSelected] = useState(options[0]?.key ?? null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) setSelected(options[0]?.key ?? null);
  }, [visible, options]);

  const choice = options.find(o => o.key === selected) ?? null;

  const save = async () => {
    if (!choice || busy) return;
    setBusy(true);
    const start = choice.date.toISOString();
    try {
      const result = await addToCalendar({
        title: `${choice.title} at ${church.name}`,
        start,
        end: new Date(choice.date.getTime() + (choice.minutes ?? SERVICE_MINUTES) * 60_000).toISOString(),
        location: choice.location || address || church.name,
        notes: 'First visit — arrive 10 minutes early to find parking and a seat.',
        url: shareUrl,
      });
      await scheduleReminders(`visit:${church.id}`, `${choice.title} at ${church.name}`, start, [24, 2], { churchId: church.id });
      if (result !== 'canceled') {
        haptic.success();
        showToast(result === 'saved' ? 'Visit saved — see you there' : 'We’ll remind you before your visit', 'success');
        onClose();
      }
    } catch {
      showToast('Could not open your calendar', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Plan your visit"
      subtitle="Pick a service. We’ll add it to your calendar and remind you before you go."
      footer={
        <View style={{ gap: t.space.xs }}>
          <Button title="Add to calendar" icon="calendar-outline" onPress={save} loading={busy} disabled={!choice} fullWidth />
          {address ? (
            <Button
              title="Directions"
              icon="navigate-outline"
              variant="secondary"
              onPress={() => openInMaps({ parts: [address] }, { directions: true }).catch(() => showToast('Could not open maps', 'error'))}
              fullWidth
            />
          ) : null}
        </View>
      }
    >
      <View style={{ gap: t.space.xs }} accessibilityRole="radiogroup">
        {options.map(o => {
          const active = o.key === selected;
          return (
            <Pressable
              key={o.key}
              onPress={() => {
                haptic.tap();
                setSelected(o.key);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${o.title}, ${whenLabel(o.date)}`}
              style={[
                styles.option,
                {
                  borderRadius: t.radius.md,
                  backgroundColor: active ? t.c.goldDim : t.c.surface,
                  borderColor: active ? t.c.gold : t.c.border,
                },
              ]}
            >
              <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={20} color={active ? t.c.goldText : t.c.textFaint} />
              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong">{o.title}</AppText>
                <AppText variant="caption" tone="muted">
                  {whenLabel(o.date)}
                  {o.location ? ` · ${o.location}` : ''}
                </AppText>
              </View>
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: 1, minHeight: 56 },
});
