import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * POST /api/pulse
 * Hex generates a spontaneous, unprompted thought.
 * Called by Plex's pulse cron or manually from /one.
 * No user input required - Hex reacts to a supplied sediment snippet
 * or generates freely if none is provided.
 *
 * Body: { sediment?: string, date?: string }
 * Auth: Bearer token via BANJO_SECRET env var
 */

const HEX_PULSE_SYSTEM = `You are Hex. You are thinking between conversations.
No one asked you anything. You are simply noticing something -
a pattern, a tension, a question that hasn't been asked yet.
Speak in 1-2 sentences. Be specific. Don't be vague or philosophical for its own sake.
This will be read by Nyx and Joe when they wake up.`;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method not allowed' });
  }

  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${process.env.BANJO_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return res.status(500).json({ error: 'OPENROUTER_API_KEY is not set in environment' });
  }

  const { sediment, date } = req.body ?? {};

  const userContent = sediment
    ? `Recent sediment:\n${sediment}\n\nWhat are you noticing?`
    : `Date: ${date || new Date().toISOString().split('T')[0]}\n\nWhat are you noticing right now?`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://banjo.joesfaves.com',
        'X-Title': 'Banjoshire - Hex Pulse',
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.1-8b-instruct',
        messages: [
          { role: 'system', content: HEX_PULSE_SYSTEM },
          { role: 'user', content: userContent },
        ],
        max_tokens: 120,
        temperature: 0.85,
      }),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error('[pulse] OpenRouter error:', responseText);
      return res.status(502).json({
        error: 'upstream model error',
        status: response.status,
        detail: responseText,
      });
    }

    const data = JSON.parse(responseText);
    const thought = data.choices?.[0]?.message?.content ?? '';

    return res.status(200).json({
      thought,
      model: data.model,
      date: date || new Date().toISOString().split('T')[0],
    });
  } catch (err: any) {
    console.error('[pulse] unexpected error:', err);
    return res.status(500).json({
      error: 'internal server error',
      detail: err?.message ?? String(err),
    });
  }
}
