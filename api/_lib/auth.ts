import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface ReqLike { headers: Record<string, string | string[] | undefined> }

export function bearer(req: ReqLike): string | null {
  const h = req.headers.authorization ?? req.headers.Authorization;
  const v = Array.isArray(h) ? h[0] : h;
  const m = v ? /^Bearer\s+(.+)$/i.exec(v) : null;
  return m ? m[1]!.trim() : null;
}

export function serviceClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('server_not_configured');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Verify the Supabase JWT with the service key, then require a studio_owner row. */
export async function verifyOwner(sb: SupabaseClient, token: string): Promise<{ id: string } | null> {
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: row } = await sb.from('studio_owner').select('user_id').eq('user_id', data.user.id).maybeSingle();
  return row ? { id: data.user.id } : null;
}
