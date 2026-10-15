import * as ImagePicker from 'expo-image-picker';

export interface PickedImage {
  uri: string;
  dataUrl: string;
  bytes: number;
}

export class PickError extends Error {}

/** Opens the camera or library and returns a base64 data URL; null when the user cancels. */
export async function pickImage(opts: { source?: 'library' | 'camera'; aspect?: [number, number]; quality?: number; maxBytes?: number } = {}): Promise<PickedImage | null> {
  const { source = 'library', aspect, quality = 0.7, maxBytes = 10 * 1024 * 1024 } = opts;
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new PickError('Camera access is off. You can enable it in Settings, or choose a photo instead.');
  }
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: !!aspect,
    aspect,
    quality,
    base64: true,
  };
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (res.canceled || !res.assets?.[0]) return null;
  const asset = res.assets[0];
  if (!asset.base64) throw new PickError('Could not read that photo. Please try another.');
  const bytes = Math.floor((asset.base64.length * 3) / 4);
  if (bytes > maxBytes) throw new PickError(`That photo is too large (max ${Math.round(maxBytes / 1024 / 1024)}MB).`);
  return { uri: asset.uri, dataUrl: `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`, bytes };
}
