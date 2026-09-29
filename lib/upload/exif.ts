import 'server-only';
import sharp from 'sharp';

/**
 * Remove EXIF and GPS data from image buffer
 * Strips all metadata for privacy before storage
 * Auto-rotates based on EXIF orientation, then removes metadata
 */
export async function stripExif(buffer: Buffer, mimeType: string): Promise<Buffer> {
  try {
    // Auto-rotate based on EXIF, then convert to JPEG without metadata
    const processed = await sharp(buffer)
      .rotate() // Auto-rotate based on EXIF orientation
      .jpeg({ quality: 90, progressive: true })
      .toBuffer();

    return processed;
  } catch (error) {
    console.error('EXIF stripping failed:', error);
    throw new Error(`Failed to strip EXIF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Create a blurred variant of an image for progressive disclosure
 * Used when displaying photos with trust-based blur
 * Blur amount: 1-100 (scales to 0.1-50 in sharp)
 */
export async function createBlurVariant(
  buffer: Buffer,
  mimeType: string,
  blurAmount: number = 20
): Promise<Buffer> {
  try {
    // Clamp blur amount to safe range (sharp accepts 0.3-1000)
    const blurSigma = Math.max(0.5, Math.min(blurAmount / 5, 50));

    const blurred = await sharp(buffer)
      .blur(blurSigma)
      .jpeg({ quality: 75 }) // Lower quality for blur variant (removes metadata in JPEG)
      .toBuffer();

    return blurred;
  } catch (error) {
    console.error('Blur variant creation failed:', error);
    throw new Error(`Failed to create blur: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate image file before upload
 * - Max 5 MB
 * - Allowed types: JPEG, PNG, WebP
 * - Returns image metadata if valid
 */
export async function validateImageFile(
  buffer: Buffer,
  mimeType: string
): Promise<{ ok: boolean; error?: string; width?: number; height?: number }> {
  const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  // Check size
  if (buffer.length > MAX_SIZE) {
    return { ok: false, error: 'Image exceeds 5 MB limit' };
  }

  // Check MIME type
  if (!ALLOWED_TYPES.includes(mimeType)) {
    return { ok: false, error: 'Only JPEG, PNG, WebP allowed' };
  }

  try {
    // Validate image format and get dimensions
    const metadata = await sharp(buffer).metadata();

    if (!metadata.width || !metadata.height) {
      return { ok: false, error: 'Invalid image format' };
    }

    // Reject very small or very large images
    if (metadata.width < 100 || metadata.height < 100) {
      return { ok: false, error: 'Image too small (min 100×100)' };
    }

    if (metadata.width > 8000 || metadata.height > 8000) {
      return { ok: false, error: 'Image too large (max 8000×8000)' };
    }

    return {
      ok: true,
      width: metadata.width,
      height: metadata.height,
    };
  } catch (error) {
    return { ok: false, error: 'Invalid image file' };
  }
}
