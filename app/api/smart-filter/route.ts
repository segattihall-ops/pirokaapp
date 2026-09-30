import { z } from 'zod';
import { getSession } from '@/lib/auth/server';
import { supabaseAdmin } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

/** Only these keys ever reach the database; everything else the model emits is dropped. */
const Filters = z
  .object({
    gender: z.array(z.string().max(32)).max(10).optional(),
    orientation: z.array(z.string().max(32)).max(10).optional(),
    communities: z.array(z.string().max(32)).max(10).optional(),
    verified: z.boolean().optional(),
    distance: z.number().min(0).max(500).optional(),
    intent: z.enum(['now', 'next', 'future']).optional(),
    age: z.tuple([z.number().int().min(18).max(99), z.number().int().min(18).max(99)]).optional(),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { prompt } = (await request.json().catch(() => ({}))) as { prompt?: unknown };
    if (!prompt || typeof prompt !== 'string' || prompt.length > 500) {
      return Response.json({ error: 'Invalid prompt' }, { status: 400 });
    }
    if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: 'AI not configured' }, { status: 503 });

    const systemPrompt = `You are a filter generator for a dating app. Convert user queries to structured filters.
Allowed filters: age ([min,max]), gender (string[]), orientation (string[]), communities (string[]), verified (boolean), distance (km), intent (now/next/future).
Return ONLY a JSON object using those keys. Example: {"age":[20,35],"gender":["male"],"verified":true}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5-5',
        max_tokens: 256,
        system: systemPrompt,
        messages: [{ role: 'user', content: `Convert this to filters: "${prompt}"` }],
      }),
    });
    if (!response.ok) {
      console.error('Claude API error:', response.status);
      return Response.json({ error: 'AI service error' }, { status: 503 });
    }

    const data = (await response.json()) as { content?: { text?: string }[] };
    const text = data.content?.[0]?.text ?? '';
    let raw: unknown;
    try {
      raw = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    } catch {
      return Response.json({ error: 'Invalid filter format' }, { status: 400 });
    }
    // Unknown keys are stripped rather than rejected: the model may improvise, the DB never sees it.
    const parsed = Filters.safeParse(stripUnknown(raw));
    if (!parsed.success) return Response.json({ error: 'Invalid filter format' }, { status: 400 });
    const filters = parsed.data;

    if (!supabaseAdmin) return Response.json({ error: 'Database not configured' }, { status: 503 });

    let q = supabaseAdmin
      .from('users')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null)
      .neq('visibility', 'hidden');
    if (filters.gender?.length) q = q.overlaps('gender', filters.gender);
    if (filters.orientation?.length) q = q.overlaps('orientation', filters.orientation);
    if (filters.communities?.length) q = q.overlaps('communities', filters.communities);
    if (filters.verified !== undefined) q = q.eq('age_verified', filters.verified);

    const { count, error } = await q;
    if (error) return Response.json({ error: 'Query failed' }, { status: 500 });

    return Response.json({ prompt, filters, count: count ?? 0 });
  } catch (error) {
    console.error('Smart filter error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function stripUnknown(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const allowed = new Set(Object.keys(Filters.shape));
  return Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([k]) => allowed.has(k)));
}
