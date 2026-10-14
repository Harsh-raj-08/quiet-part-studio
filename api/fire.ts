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
    // Naive rate limit: settings/studio.lastFireAt (merged into the studio settings doc, versioned).
    getLastFire: async () => {
      const { data } = await sb.from('settings').select('data').eq('id', 'studio').maybeSingle();
      const at = (data?.data as { lastFireAt?: string } | undefined)?.lastFireAt;
      const ms = at ? Date.parse(at) : NaN;
      return Number.isFinite(ms) ? ms : null;
    },
    setLastFire: async (ms) => {
      const at = new Date(ms).toISOString();
      const { data } = await sb.from('settings').select('version').eq('id', 'studio').maybeSingle();
      await sb.rpc('write_doc', { p_table: 'settings', p_id: 'studio', p_data: { lastFireAt: at }, p_if_version: (data as { version?: number } | null)?.version ?? null, p_merge: true });
    },
    post: async () => {
      const r = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${secret}`, 'anthropic-beta': 'experimental-cc-routine-2026-04-01', 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ text: 'Jobs are queued in the Studio. Work the queue through the Worker API (playbooks/runner.md).' }),
      });
      return { ok: r.ok, body: await r.json().catch(() => null) };
    },
    now: () => Date.now(),
  });
  res.status(out.status).json(out.body);
}
