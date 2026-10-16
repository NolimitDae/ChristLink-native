import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, View, type ListRenderItemInfo } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { searchChurches } from '../../lib/features';
import type { Church } from '../../lib/types';
import { Button, EmptyState, Field, SkeletonGroup } from '../ui';
import { ChurchRow, ChurchRowSkeleton } from '../church/ChurchRow';
import { errorMessage, isNotSetUp } from '../church/churchFormat';

type Load = { kind: 'loading' } | { kind: 'ready'; churches: Church[] } | { kind: 'error'; message: string } | { kind: 'notSetUp' };

function Separator() {
  return <View style={{ height: 10 }} />;
}

export function ChurchesTab({ bottomInset }: { bottomInset: number }) {
  const t = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [state, setState] = useState<Load>({ kind: 'loading' });
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  const load = useCallback(async (q: string) => {
    try {
      setState({ kind: 'ready', churches: await searchChurches(q, 40) });
    } catch (err) {
      setState(isNotSetUp(err) ? { kind: 'notSetUp' } : { kind: 'error', message: errorMessage(err) });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    searchChurches(debounced, 40)
      .then(churches => {
        if (!cancelled) setState({ kind: 'ready', churches });
      })
      .catch(err => {
        if (!cancelled) setState(isNotSetUp(err) ? { kind: 'notSetUp' } : { kind: 'error', message: errorMessage(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const addChurch = () => router.push(session ? '/church/edit' : '/auth');

  if (state.kind === 'notSetUp') {
    return (
      <EmptyState
        art="church"
        title="Church pages are coming soon"
        body="Soon you’ll be able to find your church, see service times and follow along with everything happening there."
      />
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: t.space.md, paddingTop: t.space.sm, gap: t.space.sm }}>
        <Field
          value={query}
          onChangeText={setQuery}
          placeholder="Search by church name or city"
          accessibilityLabel="Search churches"
          returnKeyType="search"
          autoCorrect={false}
          clearButtonMode="while-editing"
          left={<Ionicons name="search" size={18} color={t.c.textFaint} />}
        />
        <Button title="Add or claim your church" variant="secondary" icon="add-circle-outline" onPress={addChurch} fullWidth />
      </View>
      {state.kind === 'loading' ? (
        <SkeletonGroup label="Loading churches">
          <View style={{ padding: t.space.md, gap: 10 }}>
            {Array.from({ length: 6 }, (_, i) => (
              <ChurchRowSkeleton key={i} />
            ))}
          </View>
        </SkeletonGroup>
      ) : state.kind === 'error' ? (
        <EmptyState art="offline" title="We couldn’t load churches" body={state.message} actionLabel="Try again" onAction={() => load(debounced)} />
      ) : (
        <FlatList
          data={state.churches}
          keyExtractor={c => c.id}
          contentContainerStyle={{ padding: t.space.md, paddingBottom: bottomInset, flexGrow: 1 }}
          ItemSeparatorComponent={Separator}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await load(debounced);
                setRefreshing(false);
              }}
              tintColor={t.c.gold}
              colors={[t.c.gold]}
            />
          }
          renderItem={({ item }: ListRenderItemInfo<Church>) => <ChurchRow church={item} onPress={() => router.push(`/church/${item.id}`)} />}
          ListEmptyComponent={
            <EmptyState
              art="church"
              title={debounced ? 'No churches found' : 'No churches listed yet'}
              body={debounced ? `We couldn’t find “${debounced}”. Add it so your community can find it too.` : 'Be the first to add your church.'}
              actionLabel="Add your church"
              onAction={addChurch}
            />
          }
        />
      )}
    </View>
  );
}
