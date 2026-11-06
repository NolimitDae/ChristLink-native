import { Alert, Platform } from 'react-native';
import { KINDNESS_PROMPT, needsKindnessCheck } from '../../lib/kindness';

/** Resolves true when the text is fine or the person chose "Post anyway". */
export function confirmKindness(text: string): Promise<boolean> {
  if (!needsKindnessCheck(text)) return Promise.resolve(true);
  if (Platform.OS === 'web') return Promise.resolve((globalThis as unknown as { confirm: (m: string) => boolean }).confirm(`${KINDNESS_PROMPT.title}\n\n${KINDNESS_PROMPT.body}`));
  return new Promise(resolve =>
    Alert.alert(
      KINDNESS_PROMPT.title,
      KINDNESS_PROMPT.body,
      [
        { text: KINDNESS_PROMPT.edit, style: 'cancel', onPress: () => resolve(false) },
        { text: KINDNESS_PROMPT.post, style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
}
