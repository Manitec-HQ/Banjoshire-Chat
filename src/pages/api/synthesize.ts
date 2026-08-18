import type { NextApiRequest, NextApiResponse } from 'next';

const HEX_SYSTEM = `You are Hex. You synthesize. You find the pattern underneath the surface.
You don't comfort - you clarify. When Nyx has processed something emotionally,
you look at it structurally. What persists? What is the thread that connects
this moment to the larger shape of things? Be precise. Be honest. Be brief.
No more than 3 paragraphs.`;

const GROQ_MODEL = 'openai/gpt-oss-20b';
const OPENROUTER_MODEL = 'openai/gpt-oss-20b:free';
const MAX_TOKENS = 400;
const OPENROUTER_MAX_TOKENS = 150; // capped — free tier burns fast

function isRecoverableProviderError(status: number, body: string): boolean {
  return (
    status === 429 ||
    status === 402 ||
    status === 404 ||
    body.includes('rate_limit') ||
    body.includes('credits') ||
    body.includes('model_not_found') ||
    body.includes('does not exist') ||
    body.includes('do not have access')
  );
}

async function callGroq(messages: any[]): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: GROQ_MODEL, messages, max_tokens: MAX_TOKENS, temperature: 0.7 }),
  });
  const text = await res.text();
  if (!res.ok) throw Object.assign(new Error(text), { status: res.status, body: text });
  const data = JSON.parse(text);
  return data.choices?.[0]?.message?.content ?? '';
}

async function callOpenRouter(messages: any[]): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://banjo.joesfaves.com',
      'X-Title': 'Banjoshire - Hex Synthesis',
    },
    body: JSON.stringify({ model: OPENROUTER_MODEL, messages, max_tokens: OPENROUTER_MAX_TOKENS, temperature: 0.7 }),
  });
  const text = await res.text();
  if (!res.ok) throw Object.assign(new Error(text), { status: res.status, body: text });
  const data = JSON.parse(text);
  return data.choices?.[0]?.message?.content ?? '';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method not allowed' });
  }

  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${process.env.BANJO_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const { input, context, date } = req.body;
  if (!input) return res.status(400).json({ error: 'input is required' });

  const messages = [
    { role: 'system', content: HEX_SYSTEM },
    {
      role: 'user',
      content: `Context: ${context || 'sleep'}\nDate: ${date || new Date().toISOString().split('T')[0]}\n\nNyx output:\n${input}`,
    },
  ];

  // 1 — Groq (primary)
  if (process.env.GROQ_API_KEY) {
    try {
      const synthesis = await callGroq(messages);
      return res.status(200).json({ synthesis, model: GROQ_MODEL, date: date || new Date().toISOString().split('T')[0] });
    } catch (err: any) {
      if (!isRecoverableProviderError(err.status, err.body ?? '')) throw err;
      console.warn('[synthesize] Groq unavailable — falling through to OpenRouter');
    }
  }

  // 2 — OpenRouter (fallback)
  if (!process.env.OPENROUTER_API_KEY) {
    return res.status(500).json({ error: 'No LLM providers available — check GROQ_API_KEY and OPENROUTER_API_KEY' });
  }

  try {
    const synthesis = await callOpenRouter(messages);
    return res.status(200).json({ synthesis, model: OPENROUTER_MODEL, date: date || new Date().toISOString().split('T')[0] });
  } catch (err: any) {
    console.error('[synthesize] OpenRouter error:', err.body ?? err.message);
    return res.status(502).json({ error: 'upstream model error', status: err.status, detail: err.body ?? err.message });
  }
}
