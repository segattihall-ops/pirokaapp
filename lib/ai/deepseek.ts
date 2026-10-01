import { DeepseekMessage } from './types';

const API_KEY = process.env.DEEPSEEK_API_KEY;
const API_URL = 'https://api.deepseek.com/v1/chat/completions';

export async function deepseekChat(messages: DeepseekMessage[], temperature = 0.7): Promise<string> {
  if (!API_KEY) throw new Error('DEEPSEEK_API_KEY not configured');

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages,
      temperature,
      max_tokens: 1024,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Deepseek API error: ${res.status} ${err}`);
  }

  const data = (await res.json()) as any;
  return data.choices[0].message.content;
}
