import type { VercelRequest, VercelResponse } from '@vercel/node';
import { bearer, serviceClient, verifyOwner } from './_lib/auth.js';
import { handleFire } from './_lib/fire-core.js';

/** POST /api/fire (owner only): fires the Claude routine so queued jobs run now. Tokens are never returned or logged. */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); res.status(405).json({ ok: false, error: 'method_not_allowed' }); return; }
  const url = process.env.ROUTINE_FIRE_URL;
  const secret = process.env.ROUTINE_FIRE_TOKEN;
  let sb: ReturnType<typeof serviceClient> | null = null;
  try { sb = serviceClient(); } catch { sb = null; }

  const out = await handleFire({
    token: bearer(req),
    // Who is asking is checked before anything about the configuration is revealed.
    verifyOwner: sb ? async (t) => !!(await verifyOwner(sb!, t)) : null,
    configured: !!(url && secret),
    // Rate limit: settings/studio.lastFireAt, claimed with a versioned write (see claimFireSlot).
    readSettings: async () => {
      const { data, error } = await sb!.from('settings').select('data,version').eq('id', 'studio').maybeSingle();
      if (error) throw new Error('read_failed');
      if (!data) return null;
      const at = (data.data as { lastFireAt?: string } | undefined)?.lastFireAt;
      const ms = at ? Date.parse(at) : NaN;
      return { version: (data as { version: number }).version, lastFireAt: Number.isFinite(ms) ? ms : null };
    },
    writeLastFire: async (iso, ifVersion) => {
      const { data, error } = await sb!.rpc('write_doc', { p_table: 'settings', p_id: 'studio', p_data: { lastFireAt: iso }, p_if_version: ifVersion, p_merge: ifVersion != null });
      if (error) return /version_conflict/.test(error.message) ? 'conflict' : 'error';
      const row = Array.isArray(data) ? data[0] : data;
      return row ? 'ok' : 'conflict';
    },
    post: async () => {
      const r = await fetch(url!, {
        method: 'POST',
        headers: { Authorization: `Bearer ${secret!}`, 'anthropic-beta': 'experimental-cc-routine-2026-04-01', 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ text: 'Jobs are queued in the Studio. Work the queue through the Worker API (playbooks/runner.md).' }),
      });
      return { ok: r.ok, body: await r.json().catch(() => null) };
    },
    now: () => Date.now(),
  });
  res.status(out.status).json(out.body);
}
