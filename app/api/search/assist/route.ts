import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/api/guard';
import { supabaseAdmin } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

const SearchAssistSchema = z.object({
  query: z.string().min(1).max(500),
});

async function claudeSearchAssist(query: string, userProfile: Record<string, any>): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return query; // Fallback: return original query
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-5-5',
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: `You are a people search assistant. Given a user's profile and their search query, refine or expand the search query to find better matches.

User Profile:
- Gender: ${userProfile.gender || 'not specified'}
- Orientation: ${userProfile.orientation || 'not specified'}
- Communities: ${userProfile.communities?.join(', ') || 'not specified'}
- Location: ${userProfile.location || 'not specified'}

Original Search Query: "${query}"

Return a single refined search query (under 100 chars) that incorporates relevant profile context. Return only the refined query, no explanation.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      return query;
    }

    const data = await response.json();
    const refined = data.content?.[0]?.text || query;
    return refined.slice(0, 200);
  } catch (err) {
    console.error('Claude search assist error:', err);
    return query;
  }
}

export async function POST(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  const userId = g.session.userId;

  try {
    const body = await request.json();
    const parsed = SearchAssistSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Not configured' }, { status: 503 });
    }

    const { query } = parsed.data;

    // Get user profile for context
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('gender,orientation,communities')
      .eq('id', userId)
      .single();

    // Refine query with Claude
    const refinedQuery = await claudeSearchAssist(query, profile || {});

    return NextResponse.json({
      original: query,
      refined: refinedQuery,
    });
  } catch (err) {
    console.error('search assist error:', err);
    return NextResponse.json({ error: 'Failed to assist with search' }, { status: 500 });
  }
}
