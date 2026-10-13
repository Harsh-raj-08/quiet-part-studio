/** Pure core of POST /api/fire, with its collaborators injected so it can be tested without a network. */
export interface FireDeps {
  token: string | null;
  verifyOwner: (token: string) => Promise<boolean>;
  getLastFire: () => Promise<number | null>;
  setLastFire: (ms: number) => Promise<void>;
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

export async function handleFire(d: FireDeps): Promise<FireOut> {
  if (!d.token) return { status: 401, body: { ok: false, error: 'unauthorized' } };
  let owner = false;
  try { owner = await d.verifyOwner(d.token); } catch { return { status: 500, body: { ok: false, error: 'auth_unavailable' } }; }
  if (!owner) return { status: 403, body: { ok: false, error: 'forbidden' } };
  const last = await d.getLastFire();
  if (last != null && d.now() - last < DEBOUNCE_MS) return { status: 429, body: { ok: false, error: 'too_soon' } };
  await d.setLastFire(d.now());
  let r: { ok: boolean; body: unknown };
  try { r = await d.post(); } catch { return { status: 502, body: { ok: false, error: 'fire_failed' } }; }
  if (!r.ok) return { status: 502, body: { ok: false, error: 'fire_failed' } };
  return { status: 200, body: { ok: true, sessionUrl: pickSessionUrl(r.body) } };
}
