import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * GET /api/ping
 * Health check endpoint for Plex sleep pipeline.
 * Plex calls this before the full sleep run to verify Banjoshire is up.
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({
    status: 'alive',
    service: 'banjoshire',
    ts: Date.now(),
  });
}
