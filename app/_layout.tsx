import '../global.css';
import React, { useEffect, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StripeProvider } from '@stripe/stripe-react-native';
import { StatusBar } from 'expo-status-bar';
import * as Sentry from '@sentry/react-native';
import type { Subscription } from 'expo-notifications';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { ToastProvider } from '../contexts/ToastContext';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { STRIPE_PK, SENTRY_DSN } from '../lib/constants';
import { logger } from '../lib/logger';
import {
  registerForPushNotifications,
  addNotificationReceivedListener,
  addNotificationResponseListener,
  removeSubscription,
} from '../lib/notifications';

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    debug: __DEV__,
    environment: __DEV__ ? 'development' : 'production',
    tracesSampleRate: __DEV__ ? 1.0 : 0.2,
  });
}

function RootNavigator() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const notifReceivedRef = useRef<Subscription | null>(null);
  const notifResponseRef = useRef<Subscription | null>(null);

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === 'auth';
    if (!session && !inAuthGroup) {
      router.replace('/auth');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, loading, segments]);

  useEffect(() => {
    if (!session?.access_token) return;

    registerForPushNotifications(session.access_token).then(token => {
      if (token) logger.info('Push notifications enabled');
    });

    notifReceivedRef.current = addNotificationReceivedListener(notification => {
      logger.info('Notification received', { title: notification.request.content.title ?? undefined });
    });

    notifResponseRef.current = addNotificationResponseListener(response => {
      const data = response.notification.request.content.data;
      if (data?.eventId && typeof data.eventId === 'string') {
        router.push(`/event/${data.eventId}`);
      }
    });

    return () => {
      if (notifReceivedRef.current) removeSubscription(notifReceivedRef.current);
      if (notifResponseRef.current) removeSubscription(notifResponseRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token]);

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading ChristLink..." />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0A0A0F' } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="auth" />
      <Stack.Screen
        name="event/[id]"
        options={{
          presentation: 'card',
          animation: 'slide_from_right',
        }}
      />
    </Stack>
  );
}

function RootLayout() {
  return (
    <SafeAreaProvider>
      <StripeProvider publishableKey={STRIPE_PK}>
        <AuthProvider>
          <ToastProvider>
            <StatusBar style="light" />
            <RootNavigator />
          </ToastProvider>
        </AuthProvider>
      </StripeProvider>
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
