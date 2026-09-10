import type { SupabaseClient } from '@supabase/supabase-js';

export async function resolveAvatarUrl(supabase: SupabaseClient, avatarUrl: string | null | undefined) {
  if (!avatarUrl) return null;

  if (avatarUrl.startsWith('storage:profile-avatars/')) {
    const storagePath = avatarUrl.replace('storage:profile-avatars/', '');
    const { data } = await supabase.storage.from('profile-avatars').createSignedUrl(storagePath, 60 * 10);
    return data?.signedUrl || null;
  }

  try {
    const parsed = new URL(avatarUrl);
    return parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}
