import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { requireUser } from '@/lib/api/guard';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;

  try {
    const { searchParams } = new URL(request.url);
    const city = searchParams.get('city');
    const radius = parseInt(searchParams.get('radius') || '5000'); // meters

    if (!supabaseAdmin || !city) {
      return NextResponse.json({ error: 'City required' }, { status: 400 });
    }

    // Get current hour's heatmap
    const now = new Date();
    now.setMinutes(0, 0, 0);

    const { data: heatmaps, error } = await supabaseAdmin
      .from('area_heatmaps')
      .select('location, active_profiles, activity_score, trend')
      .eq('city', city)
      .eq('hour_bucket', now.toISOString())
      .order('activity_score', { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch heatmap' }, { status: 500 });
    }

    return NextResponse.json({
      city,
      timestamp: now.toISOString(),
      hotspots: heatmaps
    });
  } catch (err) {
    console.error('Heatmap error:', err);
    return NextResponse.json({ error: 'Failed to fetch heatmap' }, { status: 500 });
  }
}
