import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { SITE_URL } from '../../lib/constants';
import { logger } from '../../lib/logger';
import { AppText, EmptyState, Screen } from '../../components/ui';
import { LEGAL_DOCS, LEGAL_DRAFT_NOTICE, isLegalDocKey } from '../../content/legal';

export default function LegalScreen() {
  const t = useTheme();
  const router = useRouter();
  const { doc } = useLocalSearchParams<{ doc: string }>();

  if (!isLegalDocKey(doc)) {
    return (
      <Screen back title="Legal">
        <EmptyState art="search" title="Document not found" body="This page doesn't exist." actionLabel="Go back" onAction={() => router.back()} />
      </Screen>
    );
  }

  const content = LEGAL_DOCS[doc];
  const webUrl = `${SITE_URL}/legal/${doc}`;

  const openWeb = () => {
    WebBrowser.openBrowserAsync(webUrl).catch(err => logger.warn('Could not open legal page', { error: String(err) }));
  };

  return (
    <Screen back>
      <ScrollView contentContainerStyle={{ paddingHorizontal: t.space.lg, paddingBottom: 56 }}>
        <AppText variant="title1">{content.title}</AppText>
        <AppText variant="caption" tone="muted" style={{ marginTop: 6 }}>
          Last updated {content.updated}
        </AppText>
        <AppText variant="callout" tone="gold" style={{ marginTop: t.space.sm, fontStyle: 'italic' }}>
          {LEGAL_DRAFT_NOTICE}
        </AppText>
        <View style={{ height: 1, backgroundColor: t.c.goldHairline, marginVertical: t.space.md }} />
        <AppText variant="body">{content.intro}</AppText>

        {content.sections.map(section => (
          <View key={section.heading} style={{ marginTop: t.space.lg, gap: t.space.xs }}>
            <AppText variant="title3">{section.heading}</AppText>
            {section.paragraphs.map((p, i) => (
              <AppText key={i} variant="body" tone="muted" selectable>
                {p}
              </AppText>
            ))}
          </View>
        ))}

        <Pressable
          onPress={openWeb}
          accessibilityRole="link"
          accessibilityLabel={`Open ${content.title} on the web`}
          style={({ pressed }) => ({
            marginTop: t.space.xl,
            minHeight: 48,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Ionicons name="globe-outline" size={18} color={t.c.goldText} />
          <AppText variant="callout" tone="gold" style={{ flex: 1 }}>
            View on the web: {webUrl.replace(/^https:\/\//, '')}
          </AppText>
          <Ionicons name="open-outline" size={16} color={t.c.goldText} />
        </Pressable>
      </ScrollView>
    </Screen>
  );
}
