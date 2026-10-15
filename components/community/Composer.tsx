import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { createCommunityPost } from '../../lib/api';
import { setPostType } from '../../lib/features';
import { haptic } from '../../lib/haptics';
import type { CommunityPost } from '../../lib/types';
import { communityPostSchema, formatZodErrors } from '../../lib/validation';
import { Avatar } from '../Avatar';
import { AppText, Button, Card, Chip, Field } from '../ui';
import { COMPOSER_TYPES, POST_TYPE_ICON, POST_TYPE_LABEL, type ComposerType } from './postTypes';

const MAX = 1000;

export function Composer({ onPosted }: { onPosted: (post: CommunityPost) => void }) {
  const t = useTheme();
  const router = useRouter();
  const { session, profile } = useAuth();
  const { showToast } = useToast();
  const [type, setType] = useState<ComposerType | null>(null);
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);

  if (!session) {
    return (
      <Card style={{ marginHorizontal: t.space.md, gap: t.space.sm }}>
        <AppText variant="title3">Share with the community</AppText>
        <AppText variant="callout" tone="muted">
          Post a prayer request, a praise report or a testimony, and say Amen to others.
        </AppText>
        <Button title="Sign in to post" icon="log-in-outline" onPress={() => router.push('/auth')} style={{ alignSelf: 'flex-start' }} />
      </Card>
    );
  }

  const submit = async () => {
    if (!type) {
      showToast('Choose what kind of post this is', 'info');
      return;
    }
    const parsed = communityPostSchema.safeParse({ content });
    if (!parsed.success) {
      showToast(formatZodErrors(parsed.error), 'error');
      return;
    }
    setBusy(true);
    try {
      const post = await createCommunityPost(parsed.data.content, session.access_token);
      await setPostType(post.id, type);
      haptic.success();
      onPosted({
        ...post,
        post_type: type,
        user_id: post.user_id || session.user.id,
        profiles: post.profiles ?? {
          id: session.user.id,
          full_name: profile?.full_name ?? 'You',
          avatar_url: profile?.avatar_url,
          avatar_color: profile?.avatar_color,
          role: profile?.role,
        },
      });
      setContent('');
      setType(null);
      showToast('Posted', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not post. Please try again.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const remaining = MAX - content.length;

  return (
    <Card style={{ marginHorizontal: t.space.md, gap: t.space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
        <Avatar uri={profile?.avatar_url} name={profile?.full_name} color={profile?.avatar_color} size={36} />
        <AppText variant="headline" style={{ flex: 1 }}>
          What&apos;s on your heart?
        </AppText>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.xs }} accessibilityRole="radiogroup" accessibilityLabel="Post type">
        {COMPOSER_TYPES.map(pt => (
          <Chip key={pt} label={POST_TYPE_LABEL[pt]} icon={POST_TYPE_ICON[pt]} selected={type === pt} onPress={() => setType(pt)} />
        ))}
      </View>
      <Field
        value={content}
        onChangeText={setContent}
        placeholder="Share a prayer, praise or testimony…"
        multiline
        maxLength={MAX}
        accessibilityLabel="Post text"
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <AppText variant="caption" tone={remaining < 50 ? 'danger' : 'faint'} accessibilityLabel={`${remaining} characters left`}>
          {content.length}/{MAX}
        </AppText>
        <Button title="Post" size="sm" onPress={submit} loading={busy} disabled={!type || !content.trim()} />
      </View>
    </Card>
  );
}
