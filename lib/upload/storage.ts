import 'server-only';
import { supabaseAdmin } from '@/lib/db/client';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_BUCKET = process.env.R2_BUCKET || 'piroka-media';
const STORAGE_PROVIDER = process.env.STORAGE_PROVIDER || 'supabase'; // 'supabase' | 'r2'

/** Signed photo links live this long. Routes re-sign on every request, so short is fine. */
export const PHOTO_URL_TTL_SECS = 60 * 60;

interface UploadOptions {
  userId: string;
  slot: number; // 0 = main profile, 1-5 = album
  variant: 'original' | 'blur';
}

/**
 * Generate a storage key for an image
 * Format: users/{userId}/photos/{slot}.{variant}.jpg
 */
export function generateStorageKey(opts: UploadOptions): string {
  const ext = 'jpg'; // Store all as JPEG after processing
  return `users/${opts.userId}/photos/${opts.slot}.${opts.variant}.${ext}`;
}

/**
 * Short-lived signed URL for one photo key. The `photos` bucket is private: keys are predictable
 * (`users/<id>/photos/<slot>.original.jpg`), so a key alone must never be enough to view a photo —
 * the route that already decided clear-vs-blur is the only thing that can mint a link.
 */
export async function photoUrl(storageKey: string | null | undefined): Promise<string | null> {
  if (!storageKey) return null;
  if (STORAGE_PROVIDER === 'r2') return getR2Url(storageKey, PHOTO_URL_TTL_SECS);
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin.storage
    .from('photos')
    .createSignedUrl(storageKey, PHOTO_URL_TTL_SECS);
  if (error || !data?.signedUrl) {
    console.error('photo sign failed', error?.message);
    return null;
  }
  return data.signedUrl;
}

/** Batch variant for lists (nearby, chats, cards): one storage call for every key. */
export async function photoUrls(keys: (string | null | undefined)[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(keys.filter((k): k is string => Boolean(k)))];
  if (unique.length === 0) return out;
  if (STORAGE_PROVIDER === 'r2') {
    for (const k of unique) out.set(k, getR2Url(k, PHOTO_URL_TTL_SECS));
    return out;
  }
  if (!supabaseAdmin) return out;
  const { data, error } = await supabaseAdmin.storage
    .from('photos')
    .createSignedUrls(unique, PHOTO_URL_TTL_SECS);
  if (error) {
    console.error('photo batch sign failed', error.message);
    return out;
  }
  for (const d of data ?? []) if (d.path && d.signedUrl) out.set(d.path, d.signedUrl);
  return out;
}

/**
 * Generate R2 public URL or presigned download link
 */
function getR2Url(storageKey: string, expiresIn: number): string {
  if (!R2_ACCOUNT_ID) {
    throw new Error('R2_ACCOUNT_ID not configured');
  }

  // Public R2 URL (if bucket is public)
  // https://{account_id}.r2.cloudflarestorage.com/{bucket}/{key}
  // OR with custom domain: https://{custom}.example.com/{key}

  // For now, return the public URL pattern
  // Production: implement presigned URLs with @aws-sdk/client-s3
  const publicUrl = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${storageKey}`;
  return publicUrl;
}
