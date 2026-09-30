import { NextResponse } from 'next/server';
import { z } from 'zod';
import { deepseekChat } from '@/lib/ai/deepseek';
import type { ModerationResult, ModerationFlag } from '@/lib/ai/types';

export const dynamic = 'force-dynamic';

const Body = z.object({
  text: z.string().min(1).max(5000),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = Body.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

  const { text } = parsed.data;

  try {
    // Deepseek moderation: check for hate speech, adult content, violence, spam
    const moderationPrompt = `Moderate this text for policy violations. Return ONLY JSON.
Text: "${text}"
Analyze for: hate_speech, adult_content, violence, spam
Format: {"flags": [{"category": "hate_speech", "confidence": 0.8, "reason": "..."}], "safe": true}
Return empty flags array if no violations.`;

    const result = await deepseekChat([{ role: 'user', content: moderationPrompt }], 0.3);

    let moderation: ModerationResult;
    try {
      const parsed_result = JSON.parse(result);
      moderation = {
        safe: parsed_result.safe ?? parsed_result.flags.length === 0,
        flags: (parsed_result.flags || []).map((f: any) => ({
          category: (f.category || 'other').replace('_content', ''),
          confidence: Math.min(1, Math.max(0, f.confidence || 0.5)),
          reason: f.reason || 'Flagged by moderation',
        })),
      };
    } catch {
      moderation = { safe: true, flags: [] };
    }

    return NextResponse.json({ moderation });
  } catch (err) {
    console.error('moderation error:', err);
    return NextResponse.json({ error: 'Moderation failed' }, { status: 500 });
  }
}
