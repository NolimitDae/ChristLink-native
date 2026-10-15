import '../global.css';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StripeProvider } from '@stripe/stripe-react-native';
import { StatusBar } from 'expo-status-bar';
import * as Sentry from '@sentry/react-native';
import { useFonts, DMSerifDisplay_400Regular } from '@expo-google-fonts/dm-serif-display';
import {
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
} from '@expo-google-fonts/montserrat';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';
import { ToastProvider } from '../contexts/ToastContext';
import { AppDataProvider } from '../contexts/AppDataContext';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { OfflineBanner } from '../components/OfflineBanner';
import { STRIPE_PK, SENTRY_DSN, STRIPE_MERCHANT_ID } from '../lib/constants';
import { storage } from '../lib/storage';
import {
  addNotificationResponseListener,
  registerForPushNotifications,
  removeSubscription,
  routeForNotification,
} from '../lib/notifications';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    debug: false,
    environment: __DEV__ ? 'development' : 'production',
    tracesSampleRate: __DEV__ ? 1.0 : 0.2,
    sendDefaultPii: false,
  });
}

function RootNavigator() {
  const t = useTheme();
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  useEffect(() => {
    storage.getOnboardingDone().then(setOnboardingDone);
  }, [segments]);

  useEffect(() => {
    if (loading || onboardingDone === null) return;
    SplashScreen.hideAsync().catch(() => undefined);
    const first = segments[0] as string | undefined;
    if (!onboardingDone && first !== 'onboarding' && first !== 'auth' && first !== 'legal') {
      router.replace('/onboarding');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, onboardingDone, segments]);

  useEffect(() => {
    if (!session) return;
    registerForPushNotifications(false);
    const sub = addNotificationResponseListener(response => {
      const route = routeForNotification(response.notification.request.content.data as Record<string, unknown>);
      if (route) router.push(route as never);
    });
    return () => removeSubscription(sub);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);

  if (loading || onboardingDone === null) return <View style={{ flex: 1, backgroundColor: t.c.bg }} />;

  return (
    <>
      <StatusBar style={t.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.c.bg }, animation: 'slide_from_right' }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="auth" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="ticket/[id]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="host/scan" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
      </Stack>
      <OfflineBanner />
    </>
  );
}

function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    DMSerifDisplay_400Regular,
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
  });
  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <StripeProvider publishableKey={STRIPE_PK} merchantIdentifier={STRIPE_MERCHANT_ID} urlScheme="christlink">
          <AuthProvider>
            <AppDataProvider>
              <ToastProvider>
                <RootNavigator />
              </ToastProvider>
            </AppDataProvider>
          </AuthProvider>
        </StripeProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(function WrappedRootLayout() {
  return (
    <ErrorBoundary>
      <RootLayout />
    </ErrorBoundary>
  );
});
