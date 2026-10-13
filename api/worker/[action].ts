import type { VercelRequest, VercelResponse } from '@vercel/node';

/** Worker API arrives in a later phase. */
export default function handler(_req: VercelRequest, res: VercelResponse): void {
  res.status(501).json({ ok: false, error: 'not_implemented' });
}
