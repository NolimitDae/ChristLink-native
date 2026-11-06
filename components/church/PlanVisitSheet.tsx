import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { addToCalendar } from '../../lib/calendar';
import { openInMaps } from '../../lib/maps';
import { scheduleReminders } from '../../lib/notifications';
import { haptic } from '../../lib/haptics';
import { FeatureError, planChurchVisit } from '../../lib/features';
import { logger } from '../../lib/logger';
import type { Church } from '../../lib/types';
import { AppText, BottomSheet, Button, Field, IconButton, ListGroup, ListRow } from '../ui';
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
  const { session } = useAuth();
  // Connect card: only when someone runs the page and the visitor is signed in
  const canTell = !!session && !!church.claimed_by && church.claimed_by !== session.user.id;
  const [tell, setTell] = useState(true);
  const [party, setParty] = useState(1);
  const [shareEmail, setShareEmail] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!visible) return;
    setSelected(options[0]?.key ?? null);
    setTell(true);
    setParty(1);
    setShareEmail(false);
    setNote('');
  }, [visible, options]);

  const choice = options.find(o => o.key === selected) ?? null;

  const save = async () => {
    if (!choice || busy) return;
    setBusy(true);
    const start = choice.date.toISOString();
    let told = false;
    if (canTell && tell) {
      try {
        await planChurchVisit(church.id, {
          visit_at: start,
          service_label: choice.title,
          party_size: party,
          note: note.trim() || undefined,
          share_contact: shareEmail,
        });
        told = true;
      } catch (err) {
        // The calendar entry still matters; a church that can't receive cards yet shouldn't block it
        if (!(err instanceof FeatureError && err.notSetUp)) showToast(err instanceof Error ? err.message : 'Could not tell the church', 'error');
        logger.info('Visit card not sent', { error: String(err) });
      }
    }
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
        showToast(
          told ? `${church.name} knows you’re coming` : result === 'saved' ? 'Visit saved — see you there' : 'We’ll remind you before your visit',
          'success',
        );
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

      {canTell ? (
        <View style={{ marginTop: t.space.lg }}>
          <ListGroup>
            <ListRow
              icon="church-outline"
              title={`Let ${church.name} know`}
              subtitle="They’ll get a heads-up so someone can welcome you"
              toggle={tell}
              onToggle={setTell}
              last={!tell}
            />
            {tell ? (
              <>
                <View style={[styles.stepper, { borderBottomColor: t.c.border }]}>
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodyStrong">How many are coming?</AppText>
                    <AppText variant="caption" tone="muted">
                      Including you
                    </AppText>
                  </View>
                  <IconButton icon="remove" label="Fewer people" size={44} onPress={() => setParty(n => Math.max(1, n - 1))} disabled={party <= 1} />
                  <AppText variant="headline" style={{ minWidth: 28 }} align="center" accessibilityLiveRegion="polite">
                    {party}
                  </AppText>
                  <IconButton icon="add" label="More people" size={44} onPress={() => setParty(n => Math.min(20, n + 1))} disabled={party >= 20} />
                </View>
                <ListRow
                  icon="mail-outline"
                  title="Share my email"
                  subtitle="So the church can follow up after your visit"
                  toggle={shareEmail}
                  onToggle={setShareEmail}
                  last
                />
              </>
            ) : null}
          </ListGroup>
          {tell ? (
            <Field
              label="Anything they should know? (optional)"
              value={note}
              onChangeText={setNote}
              maxLength={500}
              multiline
              placeholder="e.g. bringing two kids, need wheelchair access"
            />
          ) : null}
        </View>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: 1, minHeight: 56 },
});
