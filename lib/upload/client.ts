'use client';

/**
 * Downscale a photo in the browser before upload: at most `max` px on the long side, JPEG 0.85.
 * Keeps the aspect ratio, never enlarges, and relies on the browser to apply EXIF orientation.
 * Phone photos are often 8–12 MP and over the 5 MB upload limit; this brings them to ~300–600 KB
 * while staying sharp on any screen the app renders them at.
 */
export async function prepareImage(file: File, max = 1600): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Could not read that image'));
      i.src = url;
    });
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.width * k));
    c.height = Math.max(1, Math.round(img.height * k));
    const ctx = c.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.85));
    return blob ?? file;
  } finally {
    URL.revokeObjectURL(url);
  }
}
