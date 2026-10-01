import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db/client';
import { requireUser } from '@/lib/api/guard';
import { getCountryFlag, COUNTRIES } from '@/lib/countries';

export const dynamic = 'force-dynamic';

const UpdateOriginSchema = z.object({
  originCode: z.string().length(2).optional(),
});

export async function POST(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  const userId = g.session.userId;

  try {
    const body = await request.json();
    const parsed = UpdateOriginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Not configured' }, { status: 503 });
    }

    const { originCode } = parsed.data;

    if (originCode) {
      // Validate country code
      const validCountry = COUNTRIES.find((c) => c.code === originCode);
      if (!validCountry) {
        return NextResponse.json({ error: 'Invalid country code' }, { status: 400 });
      }

      const originFlag = getCountryFlag(originCode);
      const { data, error } = await supabaseAdmin
        .from('users')
        .update({ origin: originCode, origin_flag: originFlag })
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: 'Failed to update origin' }, { status: 500 });
      }

      return NextResponse.json({ user: data });
    } else {
      // Clear origin
      const { data, error } = await supabaseAdmin
        .from('users')
        .update({ origin: null, origin_flag: null })
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: 'Failed to clear origin' }, { status: 500 });
      }

      return NextResponse.json({ user: data });
    }
  } catch (err) {
    console.error('origin update error:', err);
    return NextResponse.json({ error: 'Failed to update origin' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  const userId = g.session.userId;

  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Not configured' }, { status: 503 });
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .select('origin, origin_flag')
      .eq('id', userId)
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch origin' }, { status: 500 });
    }

    return NextResponse.json({
      origin: data.origin || null,
      flag: data.origin_flag || null,
    });
  } catch (err) {
    console.error('origin fetch error:', err);
    return NextResponse.json({ error: 'Failed to fetch origin' }, { status: 500 });
  }
}
