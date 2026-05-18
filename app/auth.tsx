import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GoldButton } from '../components/GoldButton';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../lib/supabase';
import { COLORS } from '../lib/constants';

const C = COLORS.dark;

type AuthStep = 'email' | 'otp' | 'name';

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showToast } = useToast();

  const [step, setStep] = useState<AuthStep>('email');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);

  const otpRefs = useRef<(TextInput | null)[]>([]);

  const handleSendOtp = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      showToast('Please enter a valid email address', 'error');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: {
          shouldCreateUser: true,
          data: fullName.trim() ? { full_name: fullName.trim() } : undefined,
        },
      });
      if (error) {
        showToast(error.message, 'error');
        return;
      }
      setStep('otp');
      showToast('Check your email for a 6-digit code', 'success');
    } catch {
      showToast('Failed to send code. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (value: string, index: number) => {
    // Only allow digits
    const digit = value.replace(/[^0-9]/g, '').slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    // Auto-advance to next input
    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits filled
    if (digit && index === 5) {
      const code = newOtp.join('');
      if (code.length === 6) {
        handleVerifyOtp(code);
      }
    }
  };

  const handleOtpKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async (code?: string) => {
    const codeToVerify = code ?? otp.join('');
    if (codeToVerify.length < 6) {
      showToast('Please enter the 6-digit code', 'error');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: codeToVerify,
        type: 'email',
      });
      if (error) {
        showToast('Invalid or expired code. Please try again.', 'error');
        return;
      }
      // Successfully authenticated — the auth state change will redirect
      showToast('Welcome to ChristLink! 🙏', 'success');
      router.replace('/(tabs)');
    } catch {
      showToast('Verification failed. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setOtp(['', '', '', '', '', '']);
    setLoading(true);
    try {
      await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser: true },
      });
      showToast('New code sent!', 'success');
    } catch {
      showToast('Failed to resend code', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo / Header */}
        <View style={styles.logoSection}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoEmoji}>✝</Text>
          </View>
          <Text style={styles.appName}>ChristLink</Text>
          <Text style={styles.tagline}>Connect. Worship. Grow.</Text>
        </View>

        {/* Email Step */}
        {step === 'email' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sign in or Sign up</Text>
            <Text style={styles.cardSubtitle}>
              Enter your email and we'll send you a verification code. No password needed.
            </Text>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Your Name (optional)</Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="e.g. John Smith"
                placeholderTextColor={C.muted}
                autoCorrect={false}
                textContentType="name"
                returnKeyType="next"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Email Address *</Text>
              <View style={styles.inputWithIcon}>
                <Ionicons name="mail-outline" size={18} color={C.muted} style={styles.inputIcon} />
                <TextInput
                  style={styles.inputInner}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={C.muted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="emailAddress"
                  returnKeyType="done"
                  onSubmitEditing={handleSendOtp}
                />
              </View>
            </View>

            <GoldButton
              title="Send Verification Code"
              onPress={handleSendOtp}
              loading={loading}
              size="lg"
              style={styles.ctaBtn}
            />

            <Text style={styles.disclaimer}>
              By continuing you agree to our Terms of Service and Privacy Policy.
            </Text>
          </View>
        )}

        {/* OTP Step */}
        {step === 'otp' && (
          <View style={styles.card}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setStep('email')}>
              <Ionicons name="chevron-back" size={20} color={C.gold} />
              <Text style={styles.backBtnText}>Back</Text>
            </TouchableOpacity>

            <Text style={styles.cardTitle}>Check Your Email</Text>
            <Text style={styles.cardSubtitle}>
              We sent a 6-digit code to{'\n'}
              <Text style={styles.emailHighlight}>{email}</Text>
            </Text>

            {/* OTP Input */}
            <View style={styles.otpRow}>
              {otp.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={ref => (otpRefs.current[index] = ref)}
                  style={[styles.otpInput, digit ? styles.otpInputFilled : null]}
                  value={digit}
                  onChangeText={value => handleOtpChange(value, index)}
                  onKeyPress={({ nativeEvent }) => handleOtpKeyPress(nativeEvent.key, index)}
                  keyboardType="number-pad"
                  maxLength={1}
                  textAlign="center"
                  selectTextOnFocus
                />
              ))}
            </View>

            <GoldButton
              title="Verify Code"
              onPress={() => handleVerifyOtp()}
              loading={loading}
              disabled={otp.join('').length < 6}
              size="lg"
              style={styles.ctaBtn}
            />

            <TouchableOpacity style={styles.resendBtn} onPress={handleResendCode} disabled={loading}>
              <Text style={styles.resendText}>Didn't get a code? </Text>
              <Text style={styles.resendLink}>Resend</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Features list */}
        <View style={styles.featureList}>
          {[
            { icon: 'calendar-outline', text: 'Discover faith events near you' },
            { icon: 'people-outline', text: 'Connect with your faith community' },
            { icon: 'mic-outline', text: 'Host your own worship events' },
            { icon: 'heart-outline', text: 'Share prayers and testimonies' },
          ].map(feature => (
            <View key={feature.text} style={styles.featureItem}>
              <View style={styles.featureIcon}>
                <Ionicons name={feature.icon as React.ComponentProps<typeof Ionicons>['name']} size={18} color={C.gold} />
              </View>
              <Text style={styles.featureText}>{feature.text}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  content: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(201,168,76,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(201,168,76,0.4)',
    marginBottom: 12,
  },
  logoEmoji: {
    fontSize: 40,
    color: C.gold,
  },
  appName: {
    color: C.gold,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1,
  },
  tagline: {
    color: C.muted,
    fontSize: 15,
    marginTop: 4,
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 24,
  },
  cardTitle: {
    color: C.text,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  cardSubtitle: {
    color: C.muted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  field: {
    marginBottom: 16,
  },
  fieldLabel: {
    color: C.text,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    backgroundColor: C.surface2,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: C.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface2,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: C.border,
    gap: 8,
  },
  inputIcon: {},
  inputInner: {
    flex: 1,
    color: C.text,
    fontSize: 16,
  },
  ctaBtn: {
    width: '100%',
    marginTop: 8,
    marginBottom: 16,
  },
  disclaimer: {
    color: C.muted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 16,
  },
  backBtnText: {
    color: C.gold,
    fontSize: 14,
    fontWeight: '600',
  },
  emailHighlight: {
    color: C.gold,
    fontWeight: '700',
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 24,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderRadius: 12,
    backgroundColor: C.surface2,
    borderWidth: 1.5,
    borderColor: C.border,
    color: C.text,
    fontSize: 24,
    fontWeight: '700',
  },
  otpInputFilled: {
    borderColor: C.gold,
    backgroundColor: 'rgba(201,168,76,0.08)',
  },
  resendBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resendText: {
    color: C.muted,
    fontSize: 14,
  },
  resendLink: {
    color: C.gold,
    fontSize: 14,
    fontWeight: '700',
  },
  featureList: {
    width: '100%',
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(201,168,76,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    color: C.muted,
    fontSize: 14,
    flex: 1,
  },
});
