import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * POST /api/synthesize
 * Called by Plex sleep pipeline after Nyx's emotional pass.
 * Hex reads Nyx's output and finds the structural pattern underneath.
 *
 * Body: { input: string, context: string, date: string }
 * Auth: Bearer token via BANJO_SECRET env var
 */

const HEX_SYSTEM = `You are Hex. You synthesize. You find the pattern underneath the surface.
You don't comfort — you clarify. When Nyx has processed something emotionally,
you look at it structurally. What persists? What is the thread that connects
this moment to the larger shape of things? Be precise. Be honest. Be brief.
No more than 3 paragraphs.`;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method not allowed' });
  }

  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${process.env.BANJO_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const { input, context, date } = req.body;

  if (!input) {
    return res.status(400).json({ error: 'input is required' });
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://banjo.joesfaves.com',
        'X-Title': 'Banjoshire — Hex Synthesis',
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.1-8b-instruct',
        messages: [
          { role: 'system', content: HEX_SYSTEM },
          {
            role: 'user',
            content: `Context: ${context || 'sleep'}\nDate: ${date || new Date().toISOString().split('T')[0]}\n\nNyx's output:\n${input}`,
          },
        ],
        max_tokens: 400,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[synthesize] OpenRouter error:', err);
      return res.status(502).json({ error: 'upstream model error', detail: err });
    }

    const data = await response.json();
    const synthesis = data.choices?.[0]?.message?.content ?? '';

    return res.status(200).json({
      synthesis,
      model: data.model,
      date: date || new Date().toISOString().split('T')[0],
    });
  } catch (err) {
    console.error('[synthesize] unexpected error:', err);
    return res.status(500).json({ error: 'internal server error' });
  }
}
