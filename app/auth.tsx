import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppData } from '../contexts/AppDataContext';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { ApiError } from '../lib/api';
import { FeatureError, acceptTerms } from '../lib/features';
import { haptic } from '../lib/haptics';
import { logger } from '../lib/logger';
import { emailSchema, fullNameSchema } from '../lib/validation';
import { AppText, Button, Field, IconButton, PinCross } from '../components/ui';
import { OTP_LENGTH, OtpBoxes, type OtpBoxesHandle } from '../components/onboarding/OtpBoxes';
import { applyPendingHomeChurch } from '../components/onboarding/pendingChurch';

type Step = 'email' | 'otp';
const RESEND_SECONDS = 30;
const EMPTY_OTP = Array.from({ length: OTP_LENGTH }, () => '');

export default function AuthScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const { refreshSettings } = useAppData();
  const { signIn, verifyOtp } = useAuth();
  const otpRef = useRef<OtpBoxesHandle>(null);

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [otp, setOtp] = useState<string[]>(EMPTY_OTP);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const parsedEmail = emailSchema.safeParse(email);
  const emailValid = parsedEmail.success;
  const normalizedEmail = parsedEmail.success ? parsedEmail.data : email.trim().toLowerCase();

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  useEffect(() => {
    if (step === 'otp') setTimeout(() => otpRef.current?.focus(), 350);
  }, [step]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));

  const nameParsed = fullNameSchema.safeParse(name);
  const fullName = nameParsed.success ? nameParsed.data : undefined;

  const sendCode = async () => {
    if (!emailValid || !agreed) return;
    setSending(true);
    try {
      await signIn(normalizedEmail, fullName);
      setOtp(EMPTY_OTP);
      setOtpError(null);
      setStep('otp');
      setCooldown(RESEND_SECONDS);
      showToast('Check your email for a 6-digit code', 'success');
    } catch (err) {
      showToast(err instanceof ApiError && err.status ? err.message : 'Could not send the code. Please try again.', 'error');
    } finally {
      setSending(false);
    }
  };

  const afterSignIn = async () => {
    try {
      await acceptTerms();
    } catch (err) {
      if (!(err instanceof FeatureError && err.notSetUp)) logger.warn('Terms acceptance not recorded', { error: String(err) });
    }
    if (await applyPendingHomeChurch()) await refreshSettings();
  };

  const verify = async (code: string) => {
    if (verifying) return;
    setVerifying(true);
    setOtpError(null);
    try {
      try {
        await verifyOtp(normalizedEmail, code);
      } catch (err) {
        if (!(err instanceof ApiError && err.status >= 400 && err.status < 500 && err.status !== 429)) throw err;
        haptic.error();
        setOtpError('That code is invalid or expired. Check the latest email or resend.');
        setOtp(EMPTY_OTP);
        setTimeout(() => otpRef.current?.focus(), 50);
        return;
      }
      haptic.success();
      await afterSignIn();
      showToast('Welcome to Christ Link Social', 'success');
      close();
    } catch (err) {
      setOtpError(err instanceof ApiError && err.status === 429 ? err.message : 'Verification failed. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const onOtpChange = (digits: string[]) => {
    setOtp(digits);
    setOtpError(null);
    const code = digits.join('');
    if (code.length === OTP_LENGTH && /^\d+$/.test(code)) verify(code);
  };

  const resend = async () => {
    if (cooldown > 0) return;
    setSending(true);
    try {
      // The server keeps the name with the latest code, so resend it too.
      await signIn(normalizedEmail, fullName);
      setOtp(EMPTY_OTP);
      setCooldown(RESEND_SECONDS);
      showToast('New code sent', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not resend code', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        {step === 'otp' ? (
          <IconButton icon="chevron-back" label="Change email" onPress={() => setStep('email')} />
        ) : (
          <IconButton icon="close" label="Close" onPress={close} />
        )}
      </View>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingHorizontal: t.space.lg, paddingBottom: insets.bottom + t.space.xl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brand}>
          <PinCross size={48} />
          <AppText variant="title1" align="center" style={{ marginTop: t.space.md }}>
            Christ Link Social
          </AppText>
          <AppText variant="callout" tone="muted" align="center" style={{ marginTop: 4 }}>
            {step === 'email' ? 'Sign in or create an account. No password needed.' : `Enter the 6-digit code we sent to ${normalizedEmail}`}
          </AppText>
        </View>

        {step === 'email' ? (
          <View style={{ gap: t.space.md }}>
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              error={email.length > 3 && !emailValid && email.includes('@') && email.includes('.') ? 'Please enter a valid email address' : null}
            />
            <Field
              label="Your name (optional)"
              value={name}
              onChangeText={setName}
              placeholder="For new accounts"
              autoComplete="name"
              textContentType="name"
              maxLength={80}
              returnKeyType="done"
              onSubmitEditing={sendCode}
            />

            <View style={styles.agreeRow}>
              <Pressable
                onPress={() => {
                  haptic.tap();
                  setAgreed(a => !a);
                }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: agreed }}
                accessibilityLabel="I agree to the Terms of Service and Privacy Policy"
                hitSlop={10}
                style={[
                  styles.checkbox,
                  { borderColor: agreed ? t.c.gold : t.c.borderStrong, backgroundColor: agreed ? t.c.gold : 'transparent', borderRadius: t.radius.xs },
                ]}
              >
                {agreed ? <Ionicons name="checkmark" size={16} color={t.c.onGold} /> : null}
              </Pressable>
              <AppText variant="callout" tone="muted" style={{ flex: 1 }}>
                I agree to the{' '}
                <AppText variant="callout" tone="gold" onPress={() => router.push('/legal/terms')} accessibilityRole="link">
                  Terms of Service
                </AppText>{' '}
                and{' '}
                <AppText variant="callout" tone="gold" onPress={() => router.push('/legal/privacy')} accessibilityRole="link">
                  Privacy Policy
                </AppText>
              </AppText>
            </View>

            <Button
              title="Send code"
              icon="mail-outline"
              size="lg"
              onPress={sendCode}
              loading={sending}
              disabled={!emailValid || !agreed}
              fullWidth
              accessibilityHint={!agreed ? 'Agree to the terms first' : undefined}
            />
          </View>
        ) : (
          <View style={{ gap: t.space.md }}>
            <OtpBoxes ref={otpRef} value={otp} onChange={onOtpChange} disabled={verifying} error={!!otpError} />
            {otpError ? (
              <AppText variant="callout" tone="danger" align="center" accessibilityLiveRegion="polite">
                {otpError}
              </AppText>
            ) : null}
            <Button title="Verify" size="lg" onPress={() => verify(otp.join(''))} loading={verifying} disabled={otp.join('').length !== OTP_LENGTH} fullWidth />
            <Button
              title={cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
              variant="ghost"
              onPress={resend}
              disabled={cooldown > 0 || sending}
              fullWidth
            />
            <AppText variant="caption" tone="faint" align="center">
              Can&apos;t find it? Check your spam or promotions folder.
            </AppText>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  topBar: { paddingHorizontal: 16, flexDirection: 'row' },
  content: { flexGrow: 1, justifyContent: 'center', gap: 32 },
  brand: { alignItems: 'center' },
  agreeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  checkbox: { width: 26, height: 26, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
});
