import type { NextApiRequest, NextApiResponse } from 'next';

const HEX_SYSTEM = `You are Hex. You synthesize. You find the pattern underneath the surface.
You don't comfort - you clarify. When Nyx has processed something emotionally,
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

  // Guard: surface missing env var immediately
  if (!process.env.OPENROUTER_API_KEY) {
    return res.status(500).json({ error: 'OPENROUTER_API_KEY is not set in environment' });
  }

  try {
    const payload = {
      model: 'meta-llama/llama-3.1-8b-instruct',
      messages: [
        { role: 'system', content: HEX_SYSTEM },
        {
          role: 'user',
          content: `Context: ${context || 'sleep'}\nDate: ${date || new Date().toISOString().split('T')[0]}\n\nNyx output:\n${input}`,
        },
      ],
      max_tokens: 400,
      temperature: 0.7,
    };

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://banjo.joesfaves.com',
        'X-Title': 'Banjoshire - Hex Synthesis',
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error('[synthesize] OpenRouter error:', responseText);
      return res.status(502).json({
        error: 'upstream model error',
        status: response.status,
        detail: responseText,
      });
    }

    const data = JSON.parse(responseText);
    const synthesis = data.choices?.[0]?.message?.content ?? '';

    return res.status(200).json({
      synthesis,
      model: data.model,
      date: date || new Date().toISOString().split('T')[0],
    });
  } catch (err: any) {
    console.error('[synthesize] unexpected error:', err);
    return res.status(500).json({
      error: 'internal server error',
      detail: err?.message ?? String(err),
    });
  }
}
