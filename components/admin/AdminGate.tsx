import React from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { EmptyState, Screen } from '../ui';

export function AdminGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAdmin, loading } = useAuth();
  if (isAdmin) return <>{children}</>;
  return (
    <Screen title="Admin" back>
      {loading ? null : (
        <EmptyState
          art="cross"
          title="Admins only"
          body="This area is for the Christ Link Social team."
          actionLabel="Go back"
          onAction={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
        />
      )}
    </Screen>
  );
}
