import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Platform, Share, StyleSheet, View, type ViewInstance } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { AppText } from './ui/AppText';
import { BottomSheet } from './ui/BottomSheet';
import { Button } from './ui/Button';
import { Logo } from './brand/Logo';
import { fonts } from '../lib/theme';
import { formatDateLong, formatTime } from '../lib/format';
import { logger } from '../lib/logger';

/** Share card content. Always rendered on brand colors (gold on warm black), regardless of theme. */
export type ShareContent =
  | { kind: 'verse'; reference: string; text: string }
  | { kind: 'event'; name: string; start?: string; place?: string; coverUrl?: string; url: string }
  | { kind: 'testimony'; text: string; author?: string };

const W = 360; // rendered at 360×640 and captured at 3× → 1080×1920
const H = 640;
const GOLD = '#C9A84C';
const IVORY = '#F6EFE3';

function CardArt({ content }: { content: ShareContent }) {
  return (
    <View style={styles.card} collapsable={false}>
      <LinearGradient colors={['#1A1612', '#0E0C0A']} style={StyleSheet.absoluteFill} />
      <View style={[styles.frame, { borderColor: 'rgba(201,168,76,0.5)' }]} />
      <View style={styles.top}>
        <Logo layout="horizontal" width={156} ground="dark" />
      </View>

      <View style={styles.body}>
        {content.kind === 'verse' ? (
          <>
            <AppText style={styles.quoteMark}>“</AppText>
            <AppText style={styles.verse}>{content.text}</AppText>
            <View style={styles.rule} />
            <AppText style={styles.ref}>{content.reference}</AppText>
          </>
        ) : content.kind === 'testimony' ? (
          <>
            <AppText style={styles.eyebrow}>ANSWERED PRAYER</AppText>
            <AppText style={[styles.verse, { fontSize: content.text.length > 220 ? 19 : 23 }]} numberOfLines={12}>
              {content.text}
            </AppText>
            {content.author ? (
              <>
                <View style={styles.rule} />
                <AppText style={styles.ref}>{content.author}</AppText>
              </>
            ) : null}
          </>
        ) : (
          <>
            {content.coverUrl ? <Image source={{ uri: content.coverUrl }} style={styles.cover} resizeMode="cover" /> : null}
            <AppText style={styles.eyebrow}>JOIN ME</AppText>
            <AppText style={[styles.verse, { fontSize: 30, lineHeight: 36 }]} numberOfLines={3}>
              {content.name}
            </AppText>
            <View style={styles.rule} />
            {content.start ? <AppText style={styles.ref}>{`${formatDateLong(content.start)} · ${formatTime(content.start)}`}</AppText> : null}
            {content.place ? <AppText style={[styles.ref, { opacity: 0.8, marginTop: 4 }]}>{content.place}</AppText> : null}
          </>
        )}
      </View>

      <AppText style={styles.footer}>christlinksocial.com</AppText>
    </View>
  );
}

export function useShareCard() {
  const [content, setContent] = useState<ShareContent | null>(null);
  const open = useCallback((c: ShareContent) => setContent(c), []);
  const close = useCallback(() => setContent(null), []);
  const sheet = <ShareCardSheet content={content} onClose={close} />;
  return { open, sheet };
}

/** Plain-text version of a card, for sharing from the website. */
export function shareText(c: ShareContent): string {
  if (c.kind === 'verse') return `“${c.text}” — ${c.reference}\n\nShared from Christ Link Social`;
  if (c.kind === 'testimony') return `${c.text}${c.author ? ` — ${c.author}` : ''}\n\nShared from Christ Link Social`;
  return `Join me at ${c.name}: ${c.url}`;
}

export function ShareCardSheet({ content, onClose }: { content: ShareContent | null; onClose: () => void }) {
  const ref = useRef<ViewInstance>(null);
  const [busy, setBusy] = useState(false);

  const [copied, setCopied] = useState(false);
  useEffect(() => setCopied(false), [content]);

  const share = async () => {
    if (!ref.current || !content) return;
    setBusy(true);
    // Browsers can't capture the card as an image: share the words (and link) instead, or copy them
    if (Platform.OS === 'web') {
      const message = shareText(content);
      try {
        await Share.share({ message });
      } catch {
        await Clipboard.setStringAsync(message).catch(() => undefined);
        setCopied(true);
      } finally {
        setBusy(false);
      }
      return;
    }
    try {
      const uri = await captureRef(ref, { format: 'png', quality: 1, width: 1080, height: 1920 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share to Stories', UTI: 'public.png' });
      } else {
        await Share.share(Platform.OS === 'ios' ? { url: uri } : { message: 'christlinksocial.com', title: 'Christ Link Social' });
      }
    } catch (err) {
      logger.warn('Share card failed', { error: String(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet
      visible={!!content}
      onClose={onClose}
      title="Share card"
      subtitle="Sized for Instagram Stories"
      footer={
        <Button
          title={Platform.OS === 'web' ? (copied ? 'Copied' : 'Share') : 'Share image'}
          icon={copied ? 'checkmark' : 'share-outline'}
          onPress={share}
          loading={busy}
          fullWidth
        />
      }
    >
      <View style={styles.previewWrap}>
        <View style={styles.previewScale}>
          <View ref={ref} collapsable={false}>
            {content ? <CardArt content={content} /> : null}
          </View>
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  previewWrap: { alignItems: 'center', height: H * 0.72, overflow: 'hidden', marginBottom: 8 },
  previewScale: { transform: [{ scale: 0.72 }], marginTop: -(H * 0.14) },
  card: { width: W, height: H, borderRadius: 4, overflow: 'hidden', padding: 32, justifyContent: 'space-between' },
  frame: { ...StyleSheet.absoluteFill, margin: 14, borderWidth: 1, borderRadius: 2 },
  top: { alignItems: 'center', gap: 10, marginTop: 18 },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  quoteMark: { color: GOLD, fontFamily: fonts.display, fontSize: 72, lineHeight: 72, height: 50 },
  verse: { color: IVORY, fontFamily: fonts.display, fontSize: 25, lineHeight: 33, textAlign: 'center' },
  rule: { width: 48, height: 1.5, backgroundColor: GOLD, marginVertical: 18 },
  ref: { color: GOLD, fontFamily: fonts.semibold, fontSize: 14, letterSpacing: 1, textAlign: 'center' },
  eyebrow: { color: GOLD, fontFamily: fonts.bold, fontSize: 11, letterSpacing: 3, marginBottom: 14 },
  cover: { width: W - 96, height: (W - 96) * 0.6, borderRadius: 10, marginBottom: 22, borderWidth: 1, borderColor: 'rgba(201,168,76,0.5)' },
  footer: { color: 'rgba(246,239,227,0.75)', fontFamily: fonts.medium, fontSize: 12, letterSpacing: 1.5, textAlign: 'center', marginBottom: 14 },
});
