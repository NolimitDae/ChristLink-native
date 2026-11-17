import { updateProfile, uploadAvatar, uploadBanner } from '../../lib/api';
import { pickImageDataUrl } from './pickImage';

/**
 * Picks a photo and saves it as the profile picture or cover. Returns false when the person cancelled; throws with
 * a readable message when the upload fails. Call refreshProfile() afterwards.
 */
export async function uploadProfileImage(kind: 'avatar' | 'banner', token: string, onUploading?: () => void): Promise<boolean> {
  const dataUrl = await pickImageDataUrl(kind === 'banner' ? [3, 1] : [1, 1]);
  if (!dataUrl) return false;
  onUploading?.();
  const { url } = kind === 'banner' ? await uploadBanner(dataUrl, token) : await uploadAvatar(dataUrl, token);
  await updateProfile(kind === 'banner' ? { banner_url: url } : { avatar_url: url }, token);
  return true;
}
