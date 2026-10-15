import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { claimChurch, searchChurches } from '../../lib/features';
import { haptic } from '../../lib/haptics';
import type { Church } from '../../lib/types';
import { AppText, Button, Card, EmptyState, Field, LineArt, SkeletonGroup } from '../ui';
import { ChurchRow, ChurchRowSkeleton } from './ChurchRow';
import { errorMessage } from './churchFormat';

interface ClaimFlowProps {
  onCreateInstead: () => void;
  onDone: () => void;
}

export function ClaimFlow({ onCreateInstead, onDone }: ClaimFlowProps) {
  const t = useTheme();
  const { showToast } = useToast();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Church[] | null>(null);
  const [picked, setPicked] = useState<Church | null>(null);
  const [role, setRole] = useState('');
  const [note, setNote] = useState('');
  const [roleError, setRoleError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const id = setTimeout(() => {
      searchChurches(query, 20)
        .then(r => {
          if (!cancelled) setResults(r);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [query]);

  const submit = async () => {
    if (!picked) return;
    if (!role.trim()) {
      setRoleError('Tell us your role, e.g. Lead Pastor or Office Admin');
      return;
    }
    setRoleError(null);
    setBusy(true);
    try {
      await claimChurch(picked.id, role.trim(), note.trim());
      haptic.success();
      setSubmitted(true);
    } catch (err) {
      showToast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (submitted && picked) {
    return (
      <Card variant="featured" style={{ alignItems: 'center', gap: t.space.sm, paddingVertical: t.space.xl }}>
        <LineArt name="church" size={88} />
        <AppText variant="title2" align="center">
          Pending review
        </AppText>
        <AppText variant="body" tone="muted" align="center">
          Thanks! Our team will verify that you serve at {picked.name}, usually within two business days. We’ll notify you when you can
          manage the page.
        </AppText>
        <Button title="Done" onPress={onDone} style={{ marginTop: t.space.sm }} />
      </Card>
    );
  }

  if (picked) {
    return (
      <View style={{ gap: t.space.md }}>
        <ChurchRow church={picked} onPress={() => setPicked(null)} selected />
        <AppText variant="caption" tone="muted">
          Tap the church to choose a different one.
        </AppText>
        <Field label="Your role at this church" value={role} onChangeText={setRole} placeholder="Lead Pastor" error={roleError} />
        <Field
          label="Anything that helps us verify (optional)"
          value={note}
          onChangeText={setNote}
          multiline
          placeholder="e.g. my church email, staff page link"
        />
        <Button title="Submit claim" icon="shield-checkmark-outline" onPress={submit} loading={busy} fullWidth size="lg" />
      </View>
    );
  }

  return (
    <View style={{ gap: t.space.md }}>
      <Field
        value={query}
        onChangeText={setQuery}
        placeholder="Search by church name or city"
        accessibilityLabel="Search churches to claim"
        autoCorrect={false}
        left={<Ionicons name="search" size={18} color={t.c.textFaint} />}
      />
      {results === null ? (
        <SkeletonGroup label="Searching churches">
          <View style={{ gap: 10 }}>
            <ChurchRowSkeleton />
            <ChurchRowSkeleton />
            <ChurchRowSkeleton />
          </View>
        </SkeletonGroup>
      ) : results.length === 0 ? (
        <EmptyState
          art="search"
          title="Not listed yet?"
          body="Create a page for your church instead — it only takes a minute."
          actionLabel="Create a church page"
          onAction={onCreateInstead}
          compact
        />
      ) : (
        <View style={{ gap: 10 }}>
          {results.map(c => (
            <ChurchRow key={c.id} church={c} onPress={() => setPicked(c)} />
          ))}
        </View>
      )}
    </View>
  );
}
