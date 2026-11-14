import { Alert, Platform } from 'react-native';

/** Yes/no confirmation that also works on the website (Alert.alert does nothing in a browser). */
export function confirmAction(title: string, body: string, confirmLabel: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve((globalThis as unknown as { confirm: (m: string) => boolean }).confirm(`${title}\n\n${body}`));
  return new Promise(resolve =>
    Alert.alert(
      title,
      body,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
}
