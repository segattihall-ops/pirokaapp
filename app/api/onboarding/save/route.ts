import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/server';
import { supabaseAdmin } from '@/lib/db/client';

/**
 * POST /api/onboarding/save
 * Save onboarding profile data to database
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      displayName,
      pronouns = [],
      gender = [],
      orientation = [],
      communities = [],
      showMe = [],
      blurPhotos = true,
      verifiedOnly = false,
      strangerFilter = true,
    } = body;

    // Validate required fields
    if (!displayName || gender.length === 0 || orientation.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: displayName, gender, orientation' },
        { status: 400 }
      );
    }

    // Check Supabase is configured
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
    }

    // Update user profile
    const { data, error } = await supabaseAdmin
      .from('users')
      .update({
        handle: displayName,
        pronouns,
        gender,
        orientation,
        communities,
        show_me: showMe,
        safety_prefs: {
          blurPhotos,
          verifiedOnly,
          strangerFilter,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.userId)
      .select();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 });
    }

    return NextResponse.json({ data: data?.[0], ok: true });
  } catch (error) {
    console.error('Error saving onboarding:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
