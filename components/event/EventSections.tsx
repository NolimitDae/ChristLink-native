import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { makeStyles, useTheme } from '../../contexts/ThemeContext';
import { formatDateShort, formatTimeRange, friendsGoingLabel, timeAgo } from '../../lib/format';
import type { ForumMessage, FriendsGoing, PersonSummary, ServeShift } from '../../lib/types';
import { Avatar } from '../Avatar';
import { AppText } from '../ui/AppText';
import { AvatarStack } from '../ui/AvatarStack';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Skeleton, SkeletonGroup } from '../ui/Skeleton';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export interface InfoTileProps {
  icon: IconName;
  label: string;
  value: string;
  sub?: string;
  subTone?: 'gold' | 'muted';
  onPress?: () => void;
  hint?: string;
}

export function InfoTile({ icon, label, value, sub, subTone = 'muted', onPress, hint }: InfoTileProps) {
  const t = useTheme();
  const s = useStyles();
  return (
    <Card style={s.tile} onPress={onPress} accessibilityLabel={`${label}: ${value}${sub ? `, ${sub}` : ''}${hint ? `. ${hint}` : ''}`}>
      <View style={s.tileTop}>
        <View style={[s.tileIcon, { backgroundColor: t.c.goldDim }]}>
          <Ionicons name={icon} size={16} color={t.c.goldText} />
        </View>
        {onPress ? <Ionicons name="arrow-forward" size={14} color={t.c.textFaint} /> : null}
      </View>
      <AppText variant="overline" tone="muted" style={{ fontSize: 10, marginTop: t.space.sm }}>
        {label}
      </AppText>
      <AppText variant="headline" numberOfLines={2} style={{ marginTop: 2 }}>
        {value}
      </AppText>
      {sub ? (
        <AppText variant="caption" tone={subTone} numberOfLines={2} style={{ marginTop: 2 }}>
          {sub}
        </AppText>
      ) : null}
    </Card>
  );
}

export function InfoGrid({ children }: { children: React.ReactNode }) {
  const s = useStyles();
  return <View style={s.grid}>{children}</View>;
}

export function WhoGoingRow({
  attendees,
  total,
  friends,
  goingCount,
  onPress,
}: {
  attendees: PersonSummary[];
  total: number;
  friends?: FriendsGoing;
  goingCount: number;
  onPress: () => void;
}) {
  const t = useTheme();
  const s = useStyles();
  const friendPeople = friends?.friends ?? [];
  const seen = new Set(friendPeople.map(p => p.id));
  const people = [...friendPeople, ...attendees.filter(a => !seen.has(a.id))];
  const label = friendsGoingLabel(friendPeople.map(p => p.full_name), friends?.friend_count ?? 0, Math.max(goingCount, total));
  const hasFriends = friendPeople.length > 0;
  return (
    <Card onPress={people.length > 0 ? onPress : undefined} accessibilityLabel={`Who's going: ${label}`} style={s.whoRow}>
      {people.length > 0 ? (
        <AvatarStack people={people} max={4} size={32} total={Math.max(people.length, total, goingCount)} />
      ) : (
        <View style={[s.tileIcon, { backgroundColor: t.c.goldDim, width: 36, height: 36, borderRadius: 18 }]}>
          <Ionicons name="people-outline" size={18} color={t.c.goldText} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <AppText variant="overline" tone="muted" style={{ fontSize: 10 }}>
          Who’s going
        </AppText>
        <AppText variant="bodyStrong" tone={hasFriends ? 'gold' : 'default'} numberOfLines={1}>
          {label}
        </AppText>
      </View>
      {people.length > 0 ? <Ionicons name="chevron-forward" size={18} color={t.c.textFaint} /> : null}
    </Card>
  );
}

export function AttendeesSheet({ visible, onClose, attendees, total }: { visible: boolean; onClose: () => void; attendees: PersonSummary[]; total: number }) {
  const t = useTheme();
  const router = useRouter();
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Who’s going" subtitle={`${total} ${total === 1 ? 'person' : 'people'}`}>
      {attendees.map((p, i) => (
        <Pressable
          key={p.id}
          onPress={() => {
            onClose();
            router.push(`/user/${p.id}`);
          }}
          accessibilityRole="button"
          accessibilityLabel={`View ${p.full_name}'s profile`}
          style={({ pressed }) => [
            styles.personRow,
            { borderBottomColor: t.c.border, borderBottomWidth: i === attendees.length - 1 ? 0 : StyleSheet.hairlineWidth, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Avatar uri={p.avatar_url} name={p.full_name} color={p.avatar_color} size={40} />
          <AppText variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
            {p.full_name}
          </AppText>
          <Ionicons name="chevron-forward" size={18} color={t.c.textFaint} />
        </Pressable>
      ))}
      {total > attendees.length ? (
        <AppText variant="caption" tone="faint" align="center" style={{ marginTop: t.space.sm }}>
          Some guests keep their RSVPs private
        </AppText>
      ) : null}
    </BottomSheet>
  );
}

const ABOUT_LIMIT = 260;

export function AboutSection({ text }: { text: string }) {
  const t = useTheme();
  const [expanded, setExpanded] = useState(false);
  const long = text.length > ABOUT_LIMIT || text.split('\n').length > 5;
  return (
    <View style={{ paddingHorizontal: t.space.md }}>
      <AppText variant="body" tone="muted" numberOfLines={expanded || !long ? undefined : 5} selectable>
        {text}
      </AppText>
      {long ? (
        <Pressable
          onPress={() => setExpanded(e => !e)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={expanded ? 'Show less' : 'Read more'}
          style={{ marginTop: t.space.xs, alignSelf: 'flex-start' }}
        >
          <AppText variant="bodyStrong" tone="gold">
            {expanded ? 'Show less' : 'Read more'}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

export function ForumPreview({
  messages,
  loading,
  canJoin,
  onOpen,
}: {
  messages: ForumMessage[];
  loading: boolean;
  canJoin: boolean;
  onOpen: () => void;
}) {
  const t = useTheme();
  const s = useStyles();
  const latest = [...messages].sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(-2);
  return (
    <Card style={{ marginHorizontal: t.space.md, gap: t.space.sm }}>
      {!canJoin ? (
        <View style={s.lockRow}>
          <View style={[s.tileIcon, { backgroundColor: t.c.goldDim }]}>
            <Ionicons name="chatbubbles-outline" size={16} color={t.c.goldText} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="bodyStrong">Event discussion</AppText>
            <AppText variant="caption" tone="muted">
              RSVP to join the conversation
            </AppText>
          </View>
          <Ionicons name="lock-closed-outline" size={16} color={t.c.textFaint} />
        </View>
      ) : loading ? (
        <SkeletonGroup label="Loading discussion">
          <View style={{ gap: t.space.sm }}>
            <Skeleton width="70%" height={12} />
            <Skeleton width="50%" height={12} />
          </View>
        </SkeletonGroup>
      ) : (
        <>
          {latest.length === 0 ? (
            <AppText variant="callout" tone="muted">
              No messages yet. Say hello to everyone going.
            </AppText>
          ) : (
            latest.map(m => (
              <View key={m.id} style={s.msgRow}>
                <Avatar uri={m.profiles?.avatar_url} name={m.profiles?.full_name} color={m.profiles?.avatar_color} size={28} />
                <View style={{ flex: 1 }}>
                  <AppText variant="caption" tone="muted">
                    {m.profiles?.full_name ?? 'Guest'} · {timeAgo(m.created_at)}
                  </AppText>
                  <AppText variant="callout" numberOfLines={2}>
                    {m.content}
                  </AppText>
                </View>
              </View>
            ))
          )}
          <Button title="Open discussion" icon="chatbubbles-outline" variant="secondary" size="sm" onPress={onOpen} style={{ alignSelf: 'flex-start' }} />
        </>
      )}
    </Card>
  );
}

export function ServeCard({ shifts, onPress }: { shifts: ServeShift[]; onPress: () => void }) {
  const t = useTheme();
  const s = useStyles();
  const open = shifts.reduce((n, sh) => n + Math.max(0, sh.spots - sh.taken), 0);
  const roles = [...new Set(shifts.map(sh => sh.role_name))];
  const first = shifts[0];
  return (
    <Card variant="featured" onPress={onPress} style={{ marginHorizontal: t.space.md }} accessibilityLabel={`Volunteer at this event. ${open} spots open.`}>
      <View style={s.lockRow}>
        <View style={[s.tileIcon, { backgroundColor: t.c.gold }]}>
          <Ionicons name="hand-left-outline" size={16} color={t.c.onGold} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="headline">Volunteer at this event</AppText>
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {roles.slice(0, 3).join(' · ')}
          </AppText>
          {first ? (
            <AppText variant="caption" tone="gold" style={{ marginTop: 2 }}>
              {open} {open === 1 ? 'spot' : 'spots'} open · {formatDateShort(first.starts_at)} {formatTimeRange(first.starts_at, first.ends_at)}
            </AppText>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color={t.c.textFaint} />
      </View>
    </Card>
  );
}

export function EventDetailSkeleton({ heroHeight }: { heroHeight: number }) {
  const t = useTheme();
  const s = useStyles();
  return (
    <SkeletonGroup label="Loading event">
      <Skeleton height={heroHeight} radius={0} />
      <View style={{ padding: t.space.md, gap: t.space.sm }}>
        <Skeleton width="30%" height={10} />
        <Skeleton width="85%" height={28} />
        <Skeleton width="60%" height={28} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xs, marginTop: t.space.xs }}>
          <Skeleton width={32} height={32} radius={16} />
          <Skeleton width="45%" height={14} />
        </View>
        <View style={[s.grid, { paddingHorizontal: 0, marginTop: t.space.md }]}>
          {[0, 1, 2, 3].map(i => (
            <Skeleton key={i} width="48%" height={112} radius={t.radius.lg} />
          ))}
        </View>
        <Skeleton height={14} style={{ marginTop: t.space.md }} />
        <Skeleton width="90%" height={14} />
        <Skeleton width="70%" height={14} />
      </View>
    </SkeletonGroup>
  );
}

const styles = StyleSheet.create({
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 8 },
});

const useStyles = makeStyles(t => ({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: t.space.sm, paddingHorizontal: t.space.md },
  tile: { width: '48.5%', minHeight: 124, padding: t.space.sm + 2 },
  tileTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tileIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  whoRow: { flexDirection: 'row', alignItems: 'center', gap: t.space.sm, marginHorizontal: t.space.md },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: t.space.sm },
  msgRow: { flexDirection: 'row', gap: t.space.xs, alignItems: 'flex-start' },
}));
