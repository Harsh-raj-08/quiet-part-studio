/** Pure core of POST /api/fire, with its collaborators injected so it can be tested without a network. */
export interface FireDeps {
  token: string | null;
  /** null when the service client is not configured (then nobody can be verified: 503 after the 401 check). */
  verifyOwner: ((token: string) => Promise<boolean>) | null;
  /** ROUTINE_FIRE_URL and ROUTINE_FIRE_TOKEN are set. Only revealed to the verified owner. */
  configured: boolean;
  /** settings/studio as {version, lastFireAt}, or null when the doc does not exist. Throws on a database error. */
  readSettings: () => Promise<{ version: number; lastFireAt: number | null } | null>;
  /** write_doc merge of {lastFireAt} at ifVersion (null = insert). */
  writeLastFire: (iso: string, ifVersion: number | null) => Promise<'ok' | 'conflict' | 'error'>;
  post: () => Promise<{ ok: boolean; body: unknown }>;
  now: () => number;
}
export interface FireOut { status: number; body: { ok: boolean; sessionUrl?: string; error?: string } }

export const DEBOUNCE_MS = 60_000;

export function pickSessionUrl(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const b = body as Record<string, unknown>;
  for (const k of ['claude_code_session_url', 'session_url', 'sessionUrl', 'url']) {
    const v = b[k];
    if (typeof v === 'string' && /^https:\/\//i.test(v)) return v;
  }
  return undefined;
}

/**
 * Rate limit that is atomic and fails closed: read settings/studio, refuse if lastFireAt is under 60 s old, then claim the
 * slot with a versioned write. Losing the version race means someone else just fired (429); any other error is 503.
 */
export async function claimFireSlot(d: Pick<FireDeps, 'readSettings' | 'writeLastFire' | 'now'>): Promise<'ok' | 'too_soon' | 'error'> {
  let cur: Awaited<ReturnType<FireDeps['readSettings']>>;
  try { cur = await d.readSettings(); } catch { return 'error'; }
  const now = d.now();
  if (cur?.lastFireAt != null && now - cur.lastFireAt < DEBOUNCE_MS) return 'too_soon';
  let w: 'ok' | 'conflict' | 'error';
  try { w = await d.writeLastFire(new Date(now).toISOString(), cur ? cur.version : null); } catch { return 'error'; }
  return w === 'ok' ? 'ok' : w === 'conflict' ? 'too_soon' : 'error';
}

export async function handleFire(d: FireDeps): Promise<FireOut> {
  if (!d.token) return { status: 401, body: { ok: false, error: 'unauthorized' } };
  if (!d.verifyOwner) return { status: 503, body: { ok: false, error: 'not_configured' } };
  let owner = false;
  try { owner = await d.verifyOwner(d.token); } catch { return { status: 503, body: { ok: false, error: 'auth_unavailable' } }; }
  if (!owner) return { status: 403, body: { ok: false, error: 'forbidden' } };
  if (!d.configured) return { status: 503, body: { ok: false, error: 'not_configured' } };
  const slot = await claimFireSlot(d);
  if (slot === 'too_soon') return { status: 429, body: { ok: false, error: 'too_soon' } };
  if (slot === 'error') return { status: 503, body: { ok: false, error: 'rate_limit_unavailable' } };
  let r: { ok: boolean; body: unknown };
  try { r = await d.post(); } catch { return { status: 502, body: { ok: false, error: 'fire_failed' } }; }
  if (!r.ok) return { status: 502, body: { ok: false, error: 'fire_failed' } };
  return { status: 200, body: { ok: true, sessionUrl: pickSessionUrl(r.body) } };
}
