import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db/client';
import { requireUser } from '@/lib/api/guard';
import { deepseekChat } from '@/lib/ai/deepseek';
import type { SearchResult } from '@/lib/ai/types';

export const dynamic = 'force-dynamic';

const Query = z.object({
  q: z.string().min(1).max(200),
});

export async function GET(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  const me = g.session.userId;

  const { searchParams } = new URL(request.url);
  const parsed = Query.safeParse({ q: searchParams.get('q') });
  if (!parsed.success) return NextResponse.json({ error: 'q required' }, { status: 400 });

  const { q } = parsed.data;
  if (!supabaseAdmin) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  try {
    // Validate query with Deepseek: is it a reasonable search term?
    const validationPrompt = `Is this a valid profile search query? "${q}"
Answer with ONLY: "valid" or "invalid" (nothing else).
Examples: "tall bears" = valid, "sql injection" = invalid`;

    const validation = await deepseekChat([{ role: 'user', content: validationPrompt }], 0.3);
    if (!validation.toLowerCase().includes('valid')) {
      return NextResponse.json({ results: [] });
    }

    // Deepseek: interpret the query intent
    const interpretPrompt = `Interpret this profile search query as JSON. Return ONLY valid JSON.
Query: "${q}"
Format: {"keywords": ["word1", "word2"], "intent": "looking_for_attribute|hobby|location|other"}
Example: {"keywords": ["tall", "bear"], "intent": "looking_for_attribute"}`;

    const interpretation = await deepseekChat([{ role: 'user', content: interpretPrompt }], 0.3);
    let parsed_intent: any;
    try {
      parsed_intent = JSON.parse(interpretation);
    } catch {
      parsed_intent = { keywords: q.split(' '), intent: 'other' };
    }

    // Search: bio + handle contains keywords (simple for MVP)
    const keywords = parsed_intent.keywords || q.split(' ');
    const searchPattern = keywords.map((k: string) => `%${k}%`).join('|');

    const { data: matches } = await supabaseAdmin
      .from('users')
      .select('id, handle, photo, intent')
      .ilike('bio', searchPattern)
      .or(`handle.ilike.${searchPattern}`)
      .limit(20);

    // Score results by Deepseek: relevance to query
    if (!matches || matches.length === 0) {
      return NextResponse.json({ results: [] });
    }

    const scoringPrompt = `Rate relevance (0-1) of these profiles to query "${q}":
${matches.map((m: any) => `@${m.handle}: ${m.bio}`).join('\n')}
Format ONLY as JSON: {"@handle": 0.8, ...}`;

    const scoreStr = await deepseekChat([{ role: 'user', content: scoringPrompt }], 0.3);
    let scores: Record<string, number> = {};
    try {
      scores = JSON.parse(scoreStr);
    } catch {
      matches.forEach((m: any) => {
        scores[m.handle] = 0.5;
      });
    }

    const results: SearchResult[] = matches.map((m: any) => ({
      userId: m.id,
      handle: m.handle,
      photo: m.photo,
      intent: m.intent,
      relevance: scores[`@${m.handle}`] || 0.3,
      reason: `Matches: ${keywords.join(', ')}`,
    }));

    results.sort((a, b) => b.relevance - a.relevance);

    return NextResponse.json({ results: results.slice(0, 10) });
  } catch (err) {
    console.error('search error:', err);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
