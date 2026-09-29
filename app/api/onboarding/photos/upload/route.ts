import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/server';
import { stripExif, createBlurVariant, validateImageFile } from '@/lib/upload/exif';
import { generateStorageKey } from '@/lib/upload/storage';
import { supabaseAdmin } from '@/lib/db/client';

/**
 * POST /api/onboarding/photos/upload
 * Upload a profile photo, strip EXIF, create blur variant, save to storage
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const slot = parseInt(formData.get('slot') as string, 10);

    if (!file || isNaN(slot) || slot < 0 || slot > 5) {
      return NextResponse.json(
        { error: 'Missing file or invalid slot (0-5)' },
        { status: 400 }
      );
    }

    // Validate file
    const buffer = Buffer.from(await file.arrayBuffer());
    const validation = validateImageFile(buffer, file.type);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Strip EXIF from original
    const cleanBuffer = await stripExif(buffer, file.type);

    // Create blur variant
    const blurBuffer = await createBlurVariant(cleanBuffer, file.type);

    // Generate storage keys
    const storageKey = generateStorageKey({ userId: session.userId, slot, variant: 'original' });
    const blurKey = generateStorageKey({ userId: session.userId, slot, variant: 'blur' });

    // Upload to Supabase Storage (if configured)
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && supabaseAdmin) {
      const [origResult, blurResult] = await Promise.all([
        supabaseAdmin.storage
          .from('photos')
          .upload(storageKey, cleanBuffer, { contentType: file.type, upsert: true }),
        supabaseAdmin.storage
          .from('photos')
          .upload(blurKey, blurBuffer, { contentType: file.type, upsert: true }),
      ]);

      if (origResult.error || blurResult.error) {
        console.error('Storage upload failed:', origResult.error || blurResult.error);
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
      }
    } else {
      console.warn('Supabase Storage not configured - skipping upload');
    }

    // Save to photos table
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
    }

    const { data, error } = await supabaseAdmin
      .from('photos')
      .upsert(
        {
          user_id: session.userId,
          slot,
          storage_key: storageKey,
          blur_key: blurKey,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,slot' }
      )
      .select();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to save photo metadata' }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      photo: data?.[0],
      urls: {
        storage: storageKey,
        blur: blurKey,
      },
    });
  } catch (error) {
    console.error('Error uploading photo:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
