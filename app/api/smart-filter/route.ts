import { getSession } from '@/lib/auth/server';
import { supabaseAdmin } from '@/lib/db/client';

const ALLOWED_OPTIONS = {
  age: 'number[]',
  gender: 'string[]',
  orientation: 'string[]',
  communities: 'string[]',
  verified: 'boolean',
  distance: 'number',
  intent: 'string',
};

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { prompt } = await request.json();
    if (!prompt || typeof prompt !== 'string') {
      return Response.json({ error: 'Invalid prompt' }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json({ error: 'AI not configured' }, { status: 503 });
    }

    const systemPrompt = `You are a filter generator for a dating app. Convert user queries to structured filters.
Allowed filters: age (range), gender, orientation, communities, verified (boolean), distance (km), intent (now/next/future).
Return ONLY valid JSON with the filters. Example: {"age":[20,35],"gender":["male"],"verified":true}`;

    const userMessage = `Convert this to filters: "${prompt}"`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 256,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!response.ok) {
      console.error('Claude API error:', response.status);
      return Response.json({ error: 'AI service error' }, { status: 503 });
    }

    const data = (await response.json()) as any;
    const content = data.content?.[0]?.text || '';

    let filters = {};
    try {
      filters = JSON.parse(content);
    } catch {
      return Response.json({ error: 'Invalid filter format' }, { status: 400 });
    }

    if (!supabaseAdmin) {
      return Response.json({ error: 'Database not configured' }, { status: 503 });
    }

    const { count } = await supabaseAdmin
      .from('users')
      .select('id', { count: 'exact', head: true })
      .match(filters as any);

    return Response.json({
      prompt,
      filters,
      count: count || 0,
    });
  } catch (error) {
    console.error('Smart filter error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
