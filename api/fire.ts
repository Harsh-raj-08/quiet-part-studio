import type { VercelRequest, VercelResponse } from '@vercel/node';
import { bearer, serviceClient, verifyOwner } from './_lib/auth';
import { handleFire } from './_lib/fire-core';

/** POST /api/fire (owner only): fires the Claude routine so queued jobs run now. Tokens are never returned or logged. */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); res.status(405).json({ ok: false, error: 'method_not_allowed' }); return; }
  const url = process.env.ROUTINE_FIRE_URL;
  const secret = process.env.ROUTINE_FIRE_TOKEN;
  if (!url || !secret) { res.status(500).json({ ok: false, error: 'not_configured' }); return; }
  let sb;
  try { sb = serviceClient(); } catch { res.status(500).json({ ok: false, error: 'not_configured' }); return; }

  const out = await handleFire({
    token: bearer(req),
    verifyOwner: async (t) => !!(await verifyOwner(sb, t)),
    getLastFire: async () => {
      const { data } = await sb.from('settings').select('data').eq('id', 'worker-fire').maybeSingle();
      const at = (data?.data as { lastFiredAt?: string } | undefined)?.lastFiredAt;
      const ms = at ? Date.parse(at) : NaN;
      return Number.isFinite(ms) ? ms : null;
    },
    setLastFire: async (ms) => {
      await sb.from('settings').upsert({ id: 'worker-fire', data: { lastFiredAt: new Date(ms).toISOString() }, updated_at: new Date(ms).toISOString() });
    },
    post: async () => {
      const r = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${secret}`, 'anthropic-beta': 'experimental-cc-routine-2026-04-01', 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ text: 'jobs queued' }),
      });
      return { ok: r.ok, body: await r.json().catch(() => null) };
    },
    now: () => Date.now(),
  });
  res.status(out.status).json(out.body);
}
