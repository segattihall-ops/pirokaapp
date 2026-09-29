import 'server-only';
import * as fs from 'fs';
import * as path from 'path';

type ImageBuffer = Buffer | ArrayBuffer;

/**
 * Remove EXIF and GPS data from image buffer
 * Supports JPEG, PNG, WebP
 * Returns buffer with metadata stripped
 */
export async function stripExif(buffer: Buffer, mimeType: string): Promise<Buffer> {
  // For production, use: npm install sharp
  // const sharp = require('sharp');
  // return await sharp(buffer).withMetadata(false).toBuffer();

  // Placeholder: return as-is
  // In production, integrate sharp or piexifjs for proper EXIF removal
  return buffer;
}

/**
 * Create a blurred variant of an image for progressive disclosure
 * Used when photoBlur is enabled
 */
export async function createBlurVariant(
  buffer: Buffer,
  mimeType: string,
  blurRadius: number = 15
): Promise<Buffer> {
  // For production, use sharp:
  // const sharp = require('sharp');
  // return await sharp(buffer).blur(blurRadius).toBuffer();

  // Placeholder: return as-is
  return buffer;
}

/**
 * Validate image file before upload
 * - Max 5 MB
 * - Allowed types: JPEG, PNG, WebP
 */
export function validateImageFile(buffer: Buffer, mimeType: string): { ok: boolean; error?: string } {
  const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  if (buffer.length > MAX_SIZE) {
    return { ok: false, error: 'Image exceeds 5 MB limit' };
  }

  if (!ALLOWED_TYPES.includes(mimeType)) {
    return { ok: false, error: 'Only JPEG, PNG, WebP allowed' };
  }

  return { ok: true };
}
