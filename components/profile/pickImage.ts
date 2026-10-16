import * as ImagePicker from 'expo-image-picker';

/** Opens the photo library and returns a base64 data URL for the upload endpoints, or null if cancelled. */
export async function pickImageDataUrl(aspect: [number, number]): Promise<string | null> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect,
    quality: 0.7,
    base64: true,
  });
  const asset = res.canceled ? null : res.assets[0];
  if (!asset?.base64) return null;
  return `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`;
}
