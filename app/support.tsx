import React from 'react';
import { Linking, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { SUPPORT_EMAIL } from '../lib/constants';
import { AppText, Button, ListGroup, ListRow, Screen } from '../components/ui';

/** Help and contact: the App Store "Support URL" (christlinksocial.com/support), also reachable in the app. */
const FAQ: { q: string; a: string }[] = [
  {
    q: 'How do I sign in?',
    a: 'Enter your email and we send you a 6-digit code. There is no password. If the code doesn’t arrive within a minute, check your spam or promotions folder, then tap "Resend code".',
  },
  {
    q: 'Where are my tickets?',
    a: 'Open the Tickets tab. Your tickets are saved on your phone, so the QR code works at the door even without a signal.',
  },
  {
    q: 'How do refunds work?',
    a: 'Open the ticket and tap "Request refund". The host decides under their refund policy, and approved refunds go back to your original payment method through Stripe, usually within 5–10 business days.',
  },
  {
    q: 'How do I report or block someone?',
    a: 'Tap the ••• menu on a post, reply, prayer, message, profile, event or church and choose Report or Block. Our team reviews every report, usually within 24 hours.',
  },
  {
    q: 'How do I delete my account?',
    a: 'Settings → Delete account. Your profile, photos, posts and prayers are removed permanently. Ticket and payment records are kept, unlinked from you, as the law requires.',
  },
  {
    q: 'I host events. How do payouts work?',
    a: 'Connect Stripe from Host → Payouts. Ticket money, minus fees, is paid out to your bank by Stripe. You can see payouts and receipts in your Stripe dashboard.',
  },
];

export default function SupportScreen() {
  const t = useTheme();
  const router = useRouter();
  const { showToast } = useToast();

  const email = () => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Christ Link Social support')}`).catch(() =>
      showToast(`Email us at ${SUPPORT_EMAIL}`, 'info'),
    );
  };

  return (
    <Screen back title="Help & support">
      <ScrollView contentContainerStyle={{ paddingHorizontal: t.space.lg, paddingBottom: 56, gap: t.space.lg }}>
        <View style={{ gap: t.space.xs }}>
          <AppText variant="body" tone="muted">
            We’re a small team and we read every message. Email us and we’ll reply within two business days.
          </AppText>
          <Button title="Email support" icon="mail-outline" onPress={email} fullWidth style={{ marginTop: t.space.xs }} />
          <AppText variant="caption" tone="faint" align="center" selectable>
            {SUPPORT_EMAIL}
          </AppText>
        </View>

        {FAQ.map(item => (
          <View key={item.q} style={{ gap: t.space.xs }}>
            <AppText variant="title3" accessibilityRole="header">
              {item.q}
            </AppText>
            <AppText variant="body" tone="muted" selectable>
              {item.a}
            </AppText>
          </View>
        ))}

        <ListGroup title="Policies">
          <ListRow icon="lock-closed-outline" title="Privacy Policy" onPress={() => router.push('/legal/privacy')} />
          <ListRow icon="document-text-outline" title="Terms of Service" onPress={() => router.push('/legal/terms')} />
          <ListRow icon="people-outline" title="Community guidelines" onPress={() => router.push('/legal/guidelines')} last />
        </ListGroup>
      </ScrollView>
    </Screen>
  );
}
