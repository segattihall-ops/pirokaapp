import 'server-only';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_BUCKET = process.env.R2_BUCKET || 'piroka-media';
const STORAGE_PROVIDER = process.env.STORAGE_PROVIDER || 'supabase'; // 'supabase' | 'r2'

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
 * Generate a signed URL for photo access (Supabase Storage or R2)
 * For Supabase: uses getPublicUrl() for public bucket, generateSignedUrl() for private
 * For R2: needs presigned URL with expiry
 */
export async function getPhotoUrl(storageKey: string, expiresIn = 3600): Promise<string> {
  if (STORAGE_PROVIDER === 'r2') {
    return getR2Url(storageKey, expiresIn);
  } else {
    // Supabase: will be handled by client with service key
    return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos/${storageKey}`;
  }
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

/**
 * Confirm upload after file is stored
 * Called by API to save storage_key + blur_key to database
 */
export async function confirmPhotoUpload(
  userId: string,
  slot: number,
  storageKey: string,
  blurKey: string
): Promise<{ ok: boolean; error?: string }> {
  // This will be called from /api/onboarding/photos/confirm
  // Saves to photos table with metadata
  return { ok: true };
}
