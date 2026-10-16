import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { makeStyles, useTheme } from '../../contexts/ThemeContext';
import { AppText, Button, Card, PinCross } from '../ui';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const VALUES: { icon: IconName; title: string; body: string }[] = [
  { icon: 'calendar-outline', title: 'Faith events near you', body: 'Worship nights, Bible studies, retreats and concerts.' },
  { icon: 'people-outline', title: 'See where friends are going', body: 'RSVP together and never walk in alone.' },
  { icon: 'hand-left-outline', title: 'Pray with your community', body: 'Share requests and celebrate answered prayers.' },
  { icon: 'heart-circle-outline', title: 'Serve where it matters', body: 'Sign up for volunteer shifts at your church.' },
];

export function WelcomeStep() {
  const t = useTheme();
  const s = useStyles();
  return (
    <View style={{ flex: 1, justifyContent: 'center' }}>
      <View style={{ alignItems: 'center', marginBottom: t.space.xl }}>
        <PinCross size={64} />
        <AppText variant="display" align="center" style={{ marginTop: t.space.lg }}>
          Find your people.{'\n'}Grow your faith.
        </AppText>
      </View>
      <View style={{ gap: t.space.md }}>
        {VALUES.map(v => (
          <View key={v.title} style={s.value}>
            <View style={s.valueIcon}>
              <Ionicons name={v.icon} size={20} color={t.c.goldText} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong">{v.title}</AppText>
              <AppText variant="callout" tone="muted">
                {v.body}
              </AppText>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

interface LoopStepProps {
  notificationsOn: boolean;
  locationOn: boolean;
  onAllowNotifications: () => void;
  onAllowLocation: () => void;
  busy: 'notifications' | 'location' | null;
}

export function LoopStep({ notificationsOn, locationOn, onAllowNotifications, onAllowLocation, busy }: LoopStepProps) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, justifyContent: 'center', gap: t.space.md }}>
      <AppText variant="title1">Stay in the loop</AppText>
      <AppText variant="body" tone="muted">
        Both are optional. You can change them anytime in Settings.
      </AppText>
      <PermissionCard
        icon="notifications-outline"
        title="Notifications"
        body="We’ll confirm your tickets, remind you the day before and an hour before events you’re going to, and tell you when someone prays for you. No marketing."
        actionLabel="Allow notifications"
        done={notificationsOn}
        doneLabel="Notifications on"
        loading={busy === 'notifications'}
        onPress={onAllowNotifications}
      />
      <PermissionCard
        icon="navigate-outline"
        title="Location"
        body="Used only while the app is open to show events and churches near you. It isn’t stored or shared with anyone."
        actionLabel="Use my location"
        done={locationOn}
        doneLabel="Location on"
        loading={busy === 'location'}
        onPress={onAllowLocation}
      />
    </View>
  );
}

function PermissionCard({
  icon,
  title,
  body,
  actionLabel,
  done,
  doneLabel,
  loading,
  onPress,
}: {
  icon: IconName;
  title: string;
  body: string;
  actionLabel: string;
  done: boolean;
  doneLabel: string;
  loading: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Card style={{ gap: t.space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
        <Ionicons name={icon} size={22} color={t.c.goldText} />
        <AppText variant="headline">{title}</AppText>
      </View>
      <AppText variant="callout" tone="muted">
        {body}
      </AppText>
      {done ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36 }} accessibilityLiveRegion="polite">
          <Ionicons name="checkmark-circle" size={18} color={t.c.success} />
          <AppText variant="callout" tone="success">
            {doneLabel}
          </AppText>
        </View>
      ) : (
        <Button title={actionLabel} variant="secondary" size="sm" onPress={onPress} loading={loading} style={{ alignSelf: 'flex-start' }} />
      )}
    </Card>
  );
}

const useStyles = makeStyles(t => ({
  value: { flexDirection: 'row', alignItems: 'center', gap: t.space.sm },
  valueIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.c.goldDim,
    borderWidth: 1,
    borderColor: t.c.goldHairline,
  },
}));
