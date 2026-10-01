/**
 * Claude vision verification for test results
 * Analyzes uploaded test images to extract:
 * - Test type (HIV, STI, etc.)
 * - Result (positive/negative/undetectable)
 * - Test month
 * - Prevention methods mentioned
 */

interface VerificationResult {
  confidence: number;
  prevention: string[];
  reason: string;
  result?: 'positive' | 'negative' | 'undetectable';
}

export async function verifyTestResult(
  imageBase64: string,
  testType: string,
  testDate: string,
): Promise<VerificationResult> {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      // Fallback: low confidence without vision
      return {
        confidence: 0.3,
        prevention: [],
        reason: 'Claude API not configured',
      };
    }

    const prompt = `Analyze this test result image and extract:
1. Test type (HIV, STI panel, etc.)
2. Result (positive, negative, undetectable, inconclusive)
3. Prevention methods mentioned (PrEP, condoms, etc.)
4. Confidence score (0-1) that this is a real, valid test

Return ONLY valid JSON:
{
  "test_type": "hiv|sti|other",
  "result": "positive|negative|undetectable|inconclusive",
  "prevention": ["prep", "condoms", ...],
  "confidence": 0.85,
  "reason": "Clear negative result from certified lab"
}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-5-5',
        max_tokens: 256,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: imageBase64,
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error('Claude vision error:', response.status);
      return {
        confidence: 0.4,
        prevention: [],
        reason: 'Vision verification failed',
      };
    }

    const data = (await response.json()) as { content?: { text?: string }[] };
    const text = data.content?.[0]?.text ?? '';

    let result: any;
    try {
      result = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    } catch {
      return {
        confidence: 0.3,
        prevention: [],
        reason: 'Could not parse verification result',
      };
    }

    return {
      confidence: Math.min(1, Math.max(0, result.confidence || 0.5)),
      prevention: result.prevention || [],
      reason: result.reason || 'Test image analyzed',
      result: result.result,
    };
  } catch (err) {
    console.error('health verify error:', err);
    return {
      confidence: 0.2,
      prevention: [],
      reason: 'Verification error',
    };
  }
}
