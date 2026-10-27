import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppData } from '../contexts/AppDataContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { FeatureError, acceptTerms } from '../lib/features';
import { authErrorMessage } from '../lib/authMessages';
import { SITE_URL } from '../lib/constants';
import { haptic } from '../lib/haptics';
import { logger } from '../lib/logger';
import { supabase } from '../lib/supabase';
import { PASSWORD_MIN, emailSchema, fullNameSchema, newPasswordSchema } from '../lib/validation';
import { AppText, Button, Field, IconButton, PinCross, Segmented } from '../components/ui';
import { OTP_LENGTH, OtpBoxes, type OtpBoxesHandle } from '../components/onboarding/OtpBoxes';
import { applyPendingHomeChurch } from '../components/onboarding/pendingChurch';

type Step = 'form' | 'otp';
/** signin/signup use a password (works without any email setup); code emails a one-time code. */
type Mode = 'signin' | 'signup' | 'code';
const RESEND_SECONDS = 30;
const EMPTY_OTP = Array.from({ length: OTP_LENGTH }, () => '');
const TABS: { value: Exclude<Mode, 'code'>; label: string }[] = [
  { value: 'signin', label: 'Sign in' },
  { value: 'signup', label: 'Create account' },
];

export default function AuthScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const { refreshSettings } = useAppData();
  const otpRef = useRef<OtpBoxesHandle>(null);

  const [step, setStep] = useState<Step>('form');
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [otp, setOtp] = useState<string[]>(EMPTY_OTP);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const parsedEmail = emailSchema.safeParse(email);
  const emailValid = parsedEmail.success;
  const normalizedEmail = parsedEmail.success ? parsedEmail.data : email.trim().toLowerCase();
  const newPasswordCheck = newPasswordSchema.safeParse(password);
  const passwordOk = mode === 'signup' ? newPasswordCheck.success : password.length > 0;
  const canSubmit = emailValid && agreed && (mode === 'code' || passwordOk);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  useEffect(() => {
    if (step === 'otp') setTimeout(() => otpRef.current?.focus(), 350);
  }, [step]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));

  const switchMode = (next: Mode) => {
    haptic.tap();
    setMode(next);
    setFormError(null);
  };

  const fullName = () => {
    const parsed = fullNameSchema.safeParse(name);
    return parsed.success && parsed.data ? parsed.data : undefined;
  };

  const afterSignIn = async () => {
    try {
      await acceptTerms();
    } catch (err) {
      if (!(err instanceof FeatureError && err.notSetUp)) logger.warn('Terms acceptance not recorded', { error: String(err) });
    }
    if (await applyPendingHomeChurch()) await refreshSettings();
  };

  const finish = async (message: string) => {
    haptic.success();
    await afterSignIn();
    showToast(message, 'success');
    close();
  };

  const fail = (err: unknown) => {
    haptic.error();
    setFormError(authErrorMessage(err));
  };

  const signIn = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    if (error) return fail(error);
    await finish('Welcome back');
  };

  const signUp = async () => {
    const n = fullName();
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: n ? { data: { full_name: n } } : undefined,
    });
    if (error) return fail(error);
    // Supabase hides "already registered" behind an empty identities list when email confirmation is on.
    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      return fail({ code: 'user_already_exists' });
    }
    if (!data.session) {
      showToast('Check your email to confirm your account, then sign in.', 'success');
      setMode('signin');
      return;
    }
    await finish('Welcome to Christ Link Social');
  };

  const sendCode = async () => {
    const n = fullName();
    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: { shouldCreateUser: true, data: n ? { full_name: n } : undefined },
    });
    if (error) return fail(error);
    setOtp(EMPTY_OTP);
    setOtpError(null);
    setStep('otp');
    setCooldown(RESEND_SECONDS);
    showToast(`Check your email for a ${OTP_LENGTH}-digit code`, 'success');
  };

  const submit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    setFormError(null);
    try {
      if (mode === 'signin') await signIn();
      else if (mode === 'signup') await signUp();
      else await sendCode();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const forgotPassword = async () => {
    if (!emailValid) {
      setFormError('Enter your email above first.');
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo: SITE_URL });
      if (error) return fail(error);
      showToast('If that account exists, we emailed a reset link.', 'success');
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const verify = async (code: string) => {
    if (verifying) return;
    setVerifying(true);
    setOtpError(null);
    try {
      const { error } = await supabase.auth.verifyOtp({ email: normalizedEmail, token: code, type: 'email' });
      if (error) {
        haptic.error();
        setOtpError('That code is invalid or expired. Check the latest email or resend.');
        setOtp(EMPTY_OTP);
        setTimeout(() => otpRef.current?.focus(), 50);
        return;
      }
      await finish('Welcome to Christ Link Social');
    } catch {
      setOtpError('Verification failed. Please try again.');
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
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email: normalizedEmail, options: { shouldCreateUser: true } });
      if (error) throw error;
      setOtp(EMPTY_OTP);
      setCooldown(RESEND_SECONDS);
      showToast('New code sent', 'success');
    } catch (err) {
      showToast(authErrorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const subtitle =
    step === 'otp'
      ? `Enter the ${OTP_LENGTH}-digit code we sent to ${normalizedEmail}`
      : mode === 'signin'
        ? 'Welcome back. Use the same email and password as christlinksocial.com.'
        : mode === 'signup'
          ? 'Create your account to save events, get tickets and join the community.'
          : `We'll email you a ${OTP_LENGTH}-digit code. No password needed.`;

  const submitTitle = mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send code';
  const submitIcon = mode === 'code' ? 'mail-outline' : undefined;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        {step === 'otp' ? (
          <IconButton icon="chevron-back" label="Change email" onPress={() => setStep('form')} />
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
            {subtitle}
          </AppText>
        </View>

        {step === 'form' ? (
          <View style={{ gap: t.space.md }}>
            {mode !== 'code' ? <Segmented options={TABS} value={mode} onChange={switchMode} /> : null}

            {mode !== 'signin' ? (
              <Field
                label={mode === 'signup' ? 'Your name' : 'Your name (optional)'}
                value={name}
                onChangeText={setName}
                placeholder={mode === 'signup' ? 'First and last name' : 'For new accounts'}
                autoComplete="name"
                textContentType="name"
                maxLength={80}
                returnKeyType="next"
              />
            ) : null}

            <Field
              label="Email"
              value={email}
              onChangeText={v => {
                setEmail(v);
                setFormError(null);
              }}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType={mode === 'signup' ? 'username' : 'emailAddress'}
              returnKeyType={mode === 'code' ? 'done' : 'next'}
              onSubmitEditing={mode === 'code' ? submit : undefined}
              error={email.length > 3 && !emailValid && email.includes('@') && email.includes('.') ? 'Please enter a valid email address' : null}
            />

            {mode !== 'code' ? (
              <Field
                label="Password"
                value={password}
                onChangeText={v => {
                  setPassword(v);
                  setFormError(null);
                }}
                placeholder={mode === 'signup' ? `At least ${PASSWORD_MIN} characters` : 'Your password'}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                textContentType={mode === 'signup' ? 'newPassword' : 'password'}
                returnKeyType="done"
                onSubmitEditing={submit}
                error={mode === 'signup' && password.length > 0 && !newPasswordCheck.success ? newPasswordCheck.error.issues[0]?.message : null}
                right={
                  <Pressable
                    onPress={() => setShowPassword(s => !s)}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                    hitSlop={12}
                    style={styles.eye}
                  >
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={t.c.textMuted} />
                  </Pressable>
                }
              />
            ) : null}

            {mode === 'signin' ? (
              <Pressable onPress={forgotPassword} accessibilityRole="button" hitSlop={10} style={styles.forgot}>
                <AppText variant="callout" tone="gold">
                  Forgot password?
                </AppText>
              </Pressable>
            ) : null}

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

            {formError ? (
              <AppText variant="callout" tone="danger" align="center" accessibilityLiveRegion="polite">
                {formError}
              </AppText>
            ) : null}

            <Button
              title={submitTitle}
              icon={submitIcon}
              size="lg"
              onPress={submit}
              loading={busy}
              disabled={!canSubmit}
              fullWidth
              accessibilityHint={!agreed ? 'Agree to the terms first' : undefined}
            />

            <Button
              title={mode === 'code' ? 'Use a password instead' : 'Email me a sign-in code instead'}
              variant="ghost"
              onPress={() => switchMode(mode === 'code' ? 'signin' : 'code')}
              fullWidth
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
              disabled={cooldown > 0 || busy}
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
  eye: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', marginRight: -10 },
  forgot: { alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center', marginTop: -8 },
});
