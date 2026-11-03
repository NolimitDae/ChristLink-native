import React, { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { Stack, usePathname, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StripeProvider } from '@stripe/stripe-react-native';
import { StatusBar } from 'expo-status-bar';
import * as Sentry from '@sentry/react-native';
import { useFonts, Newsreader_500Medium } from '@expo-google-fonts/newsreader';
import {
  InstrumentSans_400Regular,
  InstrumentSans_500Medium,
  InstrumentSans_600SemiBold,
  InstrumentSans_700Bold,
} from '@expo-google-fonts/instrument-sans';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';
import { ToastProvider } from '../contexts/ToastContext';
import { AppDataProvider } from '../contexts/AppDataContext';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { OfflineBanner } from '../components/OfflineBanner';
import { STRIPE_PK, SENTRY_DSN, STRIPE_MERCHANT_ID } from '../lib/constants';
import { storage } from '../lib/storage';
import { registerForPushNotifications, routeForNotification, useLastNotificationResponse } from '../lib/notifications';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

// Web preview with sample data (docs/WEB-PREVIEW.md). Never loaded in the iOS/Android apps.
const preview: typeof import('../web-preview/demo') | null =
  Platform.OS === 'web' && process.env.EXPO_PUBLIC_DEMO === '1' ? require('../web-preview/demo') : null;
preview?.installDemo();

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
  const pathname = usePathname();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  // A deep link or push tap that arrives before onboarding is finished; opened right after it.
  const pendingRoute = useRef<string | null>(null);
  const lastResponse = useLastNotificationResponse();
  const handledResponse = useRef<string | null>(null);

  useEffect(() => {
    storage.getOnboardingDone().then(setOnboardingDone);
  }, [segments]);

  useEffect(() => {
    if (loading || onboardingDone === null) return;
    SplashScreen.hideAsync().catch(() => undefined);
    const first = segments[0] as string | undefined;
    if (!onboardingDone && first !== 'onboarding' && first !== 'auth' && first !== 'legal') {
      // Re-check storage first: finishing onboarding saves the flag and navigates in the same moment, so this
      // state can still say "not done" and would send people through onboarding a second time.
      storage.getOnboardingDone().then(done => {
        if (done) {
          setOnboardingDone(true);
          return;
        }
        // shortcut: keeps the path only (no query string); enough for /event/:id and /church/:id links.
        if (pathname && pathname !== '/') pendingRoute.current = pathname;
        router.replace('/onboarding');
      });
    } else if (onboardingDone && pendingRoute.current) {
      const to = pendingRoute.current;
      pendingRoute.current = null;
      router.push(to as never);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, onboardingDone, segments]);

  useEffect(() => {
    if (session) registerForPushNotifications(false);
  }, [session?.user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Route push taps once navigation is mounted, including the tap that cold-started the app.
  useEffect(() => {
    if (!session || !lastResponse || loading || onboardingDone === null) return;
    const id = lastResponse.notification.request.identifier;
    if (handledResponse.current === id) return;
    handledResponse.current = id;
    const route = routeForNotification(lastResponse.notification.request.content.data as Record<string, unknown>);
    if (!route) return;
    if (onboardingDone) router.push(route as never);
    else pendingRoute.current = route;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastResponse, session?.user.id, loading, onboardingDone]);

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
    Newsreader_500Medium,
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
    InstrumentSans_700Bold,
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
  if (preview?.shouldFrame()) return <preview.PhoneFrame />;
  return (
    <ErrorBoundary>
      <RootLayout />
    </ErrorBoundary>
  );
});
