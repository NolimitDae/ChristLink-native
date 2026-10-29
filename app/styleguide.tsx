import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { makeStyles, useTheme, useThemeContext } from '../contexts/ThemeContext';
import { shadow, type Palette, type TypeVariant } from '../lib/theme';
import type { PersonSummary } from '../lib/types';
import {
  AppText,
  AvatarStack,
  Badge,
  BottomSheet,
  Button,
  Card,
  Chip,
  ChipRow,
  DateBlock,
  EmptyState,
  EventCardSkeleton,
  Field,
  Glass,
  IconButton,
  LightBurst,
  LineArt,
  ListGroup,
  ListRow,
  PinCross,
  PostSkeleton,
  Screen,
  SectionHeader,
  Segmented,
  Skeleton,
  Sparkline,
  StatTile,
  TicketShell,
  TimingBadge,
} from '../components/ui';
import type { LineArtName } from '../components/ui/LineArt';
import { AppIcon } from '../components/icons/AppIcon';
import type { ThemePreference } from '../lib/theme';

const TYPE_VARIANTS: TypeVariant[] = ['display', 'title1', 'title2', 'title3', 'headline', 'body', 'bodyStrong', 'callout', 'caption', 'overline', 'button', 'numeral'];
const ART: LineArtName[] = ['cross', 'calendar', 'ticket', 'prayer', 'people', 'church', 'serve', 'search', 'bell', 'map', 'offline'];
const PEOPLE: PersonSummary[] = [
  { id: '1', full_name: 'Sarah Johnson', avatar_color: '#C9A84C' },
  { id: '2', full_name: 'Ben Okafor', avatar_color: '#4EC98C' },
  { id: '3', full_name: 'Grace Lee', avatar_color: '#5B8EE6' },
  { id: '4', full_name: 'David Adejoro', avatar_color: '#B06AE0' },
];
const TREND = [0, 2, 1, 4, 3, 6, 5, 8, 6, 9, 7, 11, 10, 14];

function Block({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  const t = useTheme();
  return (
    <View style={{ marginBottom: t.space.xl }}>
      <SectionHeader title={title} style={{ paddingHorizontal: 0 }} />
      {note ? (
        <AppText variant="caption" tone="faint" style={{ marginTop: -6, marginBottom: t.space.sm }}>
          {note}
        </AppText>
      ) : null}
      {children}
    </View>
  );
}

export default function StyleguideScreen() {
  const t = useTheme();
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const { preference, setPreference } = useThemeContext();
  const [sheet, setSheet] = useState(false);
  const [burst, setBurst] = useState(0);
  const [chip, setChip] = useState<'All' | 'Worship' | 'Youth' | 'Prayer'>('Worship');
  const [seg, setSeg] = useState<'a' | 'b' | 'c'>('a');
  const [toggle, setToggle] = useState(true);
  const [field, setField] = useState('');
  const [soon] = useState(() => new Date(Date.now() + 2 * 3_600_000).toISOString());
  const [liveStart] = useState(() => new Date(Date.now() - 30 * 60_000).toISOString());

  const colorKeys = Object.keys(t.c) as (keyof Palette)[];

  return (
    <Screen title="Style guide" back>
      <ScrollView contentContainerStyle={{ paddingHorizontal: t.space.md, paddingBottom: insets.bottom + t.space.xxxl }}>
        <Segmented<ThemePreference>
          options={[
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
            { value: 'system', label: 'System' },
          ]}
          value={preference}
          onChange={setPreference}
        />
        <AppText variant="caption" tone="muted" style={{ marginTop: t.space.xs, marginBottom: t.space.lg }}>
          Showing {t.scheme} · Reduce Motion {t.reduceMotion ? 'on' : 'off'}. Flip modes to check every component in both.
        </AppText>

        <Card style={{ marginBottom: t.space.xl, gap: t.space.sm }}>
          <AppText variant="overline" tone="muted">
            Contrast rules
          </AppText>
          <View style={s.row}>
            <AppText variant="bodyStrong" tone="gold" style={{ flex: 1 }}>
              Gold text on light uses #8A6A1F
            </AppText>
            <AppText variant="caption" tone="faint">
              goldText = {t.c.goldText}
            </AppText>
          </View>
          <View style={s.row}>
            <Button title="Gold buttons use dark text" size="sm" />
            <AppText variant="caption" tone="faint">
              onGold = {t.c.onGold}
            </AppText>
          </View>
        </Card>

        <Block title="Color tokens">
          <View style={s.wrap}>
            {colorKeys.map(k => (
              <View key={k} style={s.swatchItem}>
                <View style={[s.swatch, { backgroundColor: t.c[k] }]} />
                <AppText variant="caption" numberOfLines={1}>
                  {k}
                </AppText>
                <AppText variant="caption" tone="faint" numberOfLines={1} style={{ fontSize: 10 }}>
                  {t.c[k]}
                </AppText>
              </View>
            ))}
          </View>
        </Block>

        <Block title="Type scale" note="DM Serif Display for titles, Montserrat for text.">
          <View style={{ gap: t.space.sm }}>
            {TYPE_VARIANTS.map(v => (
              <View key={v} style={s.typeRow}>
                <AppText variant="caption" tone="faint" style={{ width: 82 }}>
                  {v} {t.type[v].fontSize}
                </AppText>
                <AppText variant={v} style={{ flex: 1 }} numberOfLines={1}>
                  {v === 'numeral' ? '1,284' : 'Walk in the light'}
                </AppText>
              </View>
            ))}
          </View>
          <View style={[s.row, { marginTop: t.space.sm, flexWrap: 'wrap' }]}>
            {(['default', 'muted', 'faint', 'gold', 'success', 'danger'] as const).map(tone => (
              <AppText key={tone} variant="callout" tone={tone}>
                {tone}
              </AppText>
            ))}
          </View>
        </Block>

        <Block title="Spacing">
          <View style={{ gap: 6 }}>
            {Object.entries(t.space).map(([k, v]) => (
              <View key={k} style={s.row}>
                <AppText variant="caption" tone="faint" style={{ width: 64 }}>
                  {k} {v}
                </AppText>
                <View style={{ width: v * 3, height: 10, borderRadius: 3, backgroundColor: t.c.gold }} />
              </View>
            ))}
          </View>
        </Block>

        <Block title="Radii & shadows">
          <View style={s.wrap}>
            {Object.entries(t.radius).map(([k, v]) => (
              <View key={k} style={{ alignItems: 'center', gap: 4 }}>
                <View style={{ width: 56, height: 56, borderRadius: Math.min(v, 28), backgroundColor: t.c.surface2, borderWidth: 1, borderColor: t.c.goldHairline }} />
                <AppText variant="caption" tone="faint">
                  {k} {v}
                </AppText>
              </View>
            ))}
          </View>
          <View style={[s.row, { marginTop: t.space.lg, gap: t.space.md }]}>
            {([1, 2, 3] as const).map(l => (
              <View key={l} style={[s.shadowBox, shadow(l, t.c.shadow)]}>
                <AppText variant="caption">shadow {l}</AppText>
              </View>
            ))}
          </View>
        </Block>

        <Block title="Glass" note="iOS blurs; Android uses a tinted solid.">
          <View style={s.glassStage}>
            <LinearGradient colors={['#C9A84C', '#2C261F', '#0E0C0A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <Glass style={s.glass}>
              <AppText variant="headline">Frosted surface</AppText>
              <AppText variant="caption" tone="muted">
                Used for floating bars and overlays
              </AppText>
            </Glass>
            <View style={{ position: 'absolute', top: 12, left: 12, flexDirection: 'row', gap: 8 }}>
              <DateBlock iso={soon} size="sm" glass />
              <Badge label="Glass" tone="glass" />
              <IconButton icon="heart-outline" label="Glass icon button" tone="glass" size={34} />
            </View>
          </View>
        </Block>

        <Block title="Buttons">
          <View style={{ gap: t.space.sm }}>
            {(['primary', 'secondary', 'ghost', 'danger'] as const).map(v => (
              <View key={v} style={[s.row, { flexWrap: 'wrap' }]}>
                <Button title={v} variant={v} size="sm" />
                <Button title={v} variant={v} icon="sparkles" />
                <Button title={v} variant={v} size="lg" />
              </View>
            ))}
            <View style={[s.row, { flexWrap: 'wrap' }]}>
              <Button title="Loading" loading />
              <Button title="Disabled" disabled />
              <Button title="Disabled" variant="secondary" disabled />
            </View>
            <Button title="Full width" fullWidth iconRight="arrow-forward" />
            <View style={s.row}>
              <IconButton icon="share-outline" label="Default" />
              <IconButton icon="add" label="Gold" tone="gold" />
              <IconButton icon="ellipsis-horizontal" label="Plain" tone="plain" />
              <IconButton icon="notifications-outline" label="With badge" badge />
            </View>
          </View>
        </Block>

        <Block title="Chips">
          <View style={[s.row, { flexWrap: 'wrap', marginBottom: t.space.sm }]}>
            <Chip label="Default" />
            <Chip label="Selected" selected />
            <Chip label="Icon" icon="location-outline" />
            <Chip label="Count" count={12} />
          </View>
          <View style={{ marginHorizontal: -t.space.md }}>
            <ChipRow options={['All', 'Worship', 'Youth', 'Prayer'] as const} value={chip} onChange={setChip} />
          </View>
        </Block>

        <Block title="Faith icons" note="Custom glyphs (AppIcon) for ideas Ionicons lacks. Outline when idle, solid when active.">
          <View style={[s.row, { flexWrap: 'wrap', gap: t.space.md }]}>
            {(
              [
                ['pray-outline', 'pray', 'Prayer · Amen'],
                ['church-outline', 'church', 'Church'],
                ['serve-outline', 'serve', 'Serve'],
                ['bible-outline', null, 'Bible'],
                ['skate-outline', null, 'Skating'],
              ] as const
            ).map(([outline, solid, label]) => (
              <View key={outline} style={{ alignItems: 'center', gap: 4, width: 72 }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <AppIcon name={outline} size={24} color={t.c.text} />
                  {solid ? <AppIcon name={solid} size={24} color={t.c.goldText} /> : null}
                </View>
                <AppText variant="caption" tone="muted" align="center">
                  {label}
                </AppText>
              </View>
            ))}
          </View>
        </Block>

        <Block title="Cards">
          <View style={{ gap: t.space.sm }}>
            <Card>
              <AppText variant="headline">Standard card</AppText>
              <AppText variant="callout" tone="muted">
                Surface, hairline border, light shadow in light mode.
              </AppText>
            </Card>
            <Card variant="featured">
              <AppText variant="headline">Featured card</AppText>
              <AppText variant="callout" tone="muted">
                Gold hairline and a soft gold wash.
              </AppText>
            </Card>
            <Card variant="outline">
              <AppText variant="headline">Outline card</AppText>
            </Card>
            <TicketShell
              style={{ height: 190 }}
              top={
                <View style={{ padding: t.space.md, gap: 4 }}>
                  <AppText variant="overline" tone="gold">
                    Admit one
                  </AppText>
                  <AppText variant="title3">Friday Night Worship</AppText>
                  <AppText variant="caption" tone="muted">
                    Grace Fellowship Hall
                  </AppText>
                </View>
              }
              bottom={
                <View style={{ paddingHorizontal: t.space.md, flexDirection: 'row', justifyContent: 'space-between' }}>
                  <AppText variant="caption" tone="muted">
                    General admission
                  </AppText>
                  <AppText variant="caption" tone="gold">
                    #7F3K9QPL
                  </AppText>
                </View>
              }
            />
          </View>
        </Block>

        <Block title="People & badges">
          <View style={[s.row, { marginBottom: t.space.md }]}>
            <AvatarStack people={PEOPLE} max={3} size={30} total={12} />
            <AvatarStack people={PEOPLE.slice(0, 2)} size={24} />
          </View>
          <View style={[s.row, { flexWrap: 'wrap' }]}>
            <Badge label="Free" tone="free" />
            <Badge label="Live" tone="live" dot />
            <TimingBadge start={soon} />
            <TimingBadge start={liveStart} />
            <Badge label="Gold" tone="gold" />
            <Badge label="Neutral" />
            <Badge label="Success" tone="success" />
            <Badge label="Danger" tone="danger" />
          </View>
          <View style={[s.row, { marginTop: t.space.md }]}>
            <DateBlock iso={soon} />
            <DateBlock iso={soon} size="sm" />
            <View style={{ padding: 8, borderRadius: t.radius.md, backgroundColor: '#2C261F' }}>
              <DateBlock iso={soon} glass />
            </View>
            <DateBlock />
          </View>
        </Block>

        <Block title="Data">
          <View style={[s.row, { flexWrap: 'wrap' }]}>
            <StatTile label="Tickets sold" value="128" trend={TREND} tone="gold" />
            <StatTile label="Net payout" value="$1,420.50" tone="success" trend={TREND} />
            <StatTile label="Going" value="64" />
          </View>
          <Card style={{ marginTop: t.space.sm }}>
            <Sparkline values={TREND} width={280} height={56} />
          </Card>
        </Block>

        <Block title="Inputs">
          <View style={{ gap: t.space.md }}>
            <Field label="Event name" value={field} onChangeText={setField} placeholder="Friday Night Worship" hint="Shown on cards and the event page" />
            <Field label="Online link" value="not a url" error="Enter a valid URL starting with https://" onChangeText={() => undefined} />
            <Field label="Description" multiline placeholder="Multiline field" />
            <Segmented
              options={[
                { value: 'a', label: 'Upcoming' },
                { value: 'b', label: 'Drafts' },
                { value: 'c', label: 'Past' },
              ]}
              value={seg}
              onChange={setSeg}
            />
          </View>
        </Block>

        <Block title="List rows">
          <ListGroup title="Settings">
            <ListRow icon="moon-outline" title="Toggle row" subtitle="With subtitle" toggle={toggle} onToggle={setToggle} />
            <ListRow icon="person-outline" title="Chevron row" value="Value" onPress={() => undefined} />
            <ListRow icon="trash-outline" title="Destructive row" destructive onPress={() => undefined} />
            <ListRow icon="lock-closed-outline" title="Disabled row" disabled onPress={() => undefined} last />
          </ListGroup>
        </Block>

        <Block title="Section header">
          <SectionHeader title="This week" eyebrow="Near you" actionLabel="See all" onAction={() => undefined} style={{ paddingHorizontal: 0 }} />
        </Block>

        <Block title="Loading">
          <View style={{ gap: t.space.sm }}>
            <Skeleton width="60%" />
            <Skeleton height={40} radius={t.radius.md} />
            <EventCardSkeleton variant="row" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <EventCardSkeleton />
            </ScrollView>
            <PostSkeleton />
          </View>
        </Block>

        <Block title="Empty state">
          <Card padded={false}>
            <EmptyState compact art="calendar" title="No upcoming events" body="Start something your community will love." actionLabel="Create an event" onAction={() => undefined} />
          </Card>
        </Block>

        <Block title="Line art">
          <View style={s.wrap}>
            {ART.map(a => (
              <View key={a} style={{ alignItems: 'center', width: 76 }}>
                <LineArt name={a} size={64} />
                <AppText variant="caption" tone="faint">
                  {a}
                </AppText>
              </View>
            ))}
            <View style={{ alignItems: 'center', width: 76 }}>
              <PinCross size={34} />
              <AppText variant="caption" tone="faint" style={{ marginTop: 4 }}>
                PinCross
              </AppText>
            </View>
          </View>
        </Block>

        <Block title="Motion" note={t.reduceMotion ? 'Reduce Motion is on: LightBurst fades only, sheets skip the slide.' : 'With Reduce Motion on, LightBurst fades without scaling.'}>
          <View style={s.row}>
            <Button title="Play LightBurst" icon="sparkles" onPress={() => setBurst(n => n + 1)} />
            <Button title="Open BottomSheet" variant="secondary" onPress={() => setSheet(true)} />
          </View>
          <View style={s.burstStage}>
            <LightBurst play={burst} size={160} />
            <AppText variant="caption" tone="faint">
              Burst stage
            </AppText>
          </View>
        </Block>
      </ScrollView>

      <BottomSheet visible={sheet} onClose={() => setSheet(false)} title="Bottom sheet" subtitle="Drag down or tap outside to close" footer={<Button title="Done" fullWidth onPress={() => setSheet(false)} />}>
        <AppText variant="body" tone="muted">
          Sheets hold secondary actions, pickers and short forms.
        </AppText>
      </BottomSheet>
    </Screen>
  );
}

const useStyles = makeStyles(t => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: t.space.xs },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm },
  swatchItem: { width: 96, gap: 2 },
  swatch: { height: 44, borderRadius: t.radius.sm, borderWidth: 1, borderColor: t.c.borderStrong },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: t.space.xs },
  shadowBox: { flex: 1, height: 72, borderRadius: t.radius.md, backgroundColor: t.c.surface, alignItems: 'center', justifyContent: 'center' },
  glassStage: { height: 180, borderRadius: t.radius.lg, overflow: 'hidden', justifyContent: 'flex-end', padding: t.space.md },
  glass: { borderRadius: t.radius.md, padding: t.space.md, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: t.c.borderStrong },
  burstStage: {
    height: 180,
    marginTop: t.space.sm,
    borderRadius: t.radius.lg,
    borderWidth: 1,
    borderColor: t.c.border,
    backgroundColor: t.c.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
}));
