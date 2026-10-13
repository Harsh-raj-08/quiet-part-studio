import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Adapter, AuthState, FireResult, UploadResult, WriteOpts } from './adapter';
import { MissingDocError, VersionConflictError } from './adapter';
import type { CollectionName, Doc, QpConfig, StudioUser } from './types';

interface Row { id: string; data: Record<string, unknown>; version: number }
const toDoc = (r: Row): Doc => ({ id: r.id, data: (r.data ?? {}) as Record<string, unknown>, version: r.version ?? 1 });

/**
 * The one place that talks to Supabase.
 * - subscribe(): initial select, then a postgres_changes channel; keeps a local map and calls cb with the array.
 *   One subscription per collection for the app's lifetime (the store enforces this).
 * - writes go through the write_doc() RPC so versions are checked in the database.
 */
export function createSupabaseAdapter(cfg: QpConfig): Adapter {
  const sb: SupabaseClient = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  const maps = new Map<CollectionName, Map<string, Doc>>();
  const cbs = new Map<CollectionName, Set<(d: Doc[]) => void>>();
  const started = new Set<CollectionName>();
  const loaded = new Set<CollectionName>();

  let auth: AuthState = { status: 'loading', user: null, owner: false };
  const authCbs = new Set<(s: AuthState) => void>();

  async function refreshAuth(sessionUser: { id: string; email?: string | null } | null) {
    if (!sessionUser) { auth = { status: 'signed-out', user: null, owner: false }; }
    else {
      const user: StudioUser = { id: sessionUser.id, email: sessionUser.email ?? '' };
      let owner = false;
      try {
        const { data } = await sb.from('studio_owner').select('user_id').eq('user_id', sessionUser.id).maybeSingle();
        owner = !!data;
      } catch { owner = false; }
      auth = { status: 'signed-in', user, owner };
    }
    for (const cb of authCbs) cb(auth);
  }
  void sb.auth.getSession().then(({ data }) => refreshAuth(data.session?.user ?? null));
  sb.auth.onAuthStateChange((_evt, session) => { void refreshAuth(session?.user ?? null); });

  const list = (c: CollectionName) => Array.from(maps.get(c)?.values() ?? []);
  const emit = (c: CollectionName) => { const l = list(c); cbs.get(c)?.forEach((cb) => cb(l)); };

  function start(c: CollectionName) {
    if (started.has(c)) return;
    started.add(c);
    maps.set(c, new Map());
    const load = async () => {
      const { data, error } = await sb.from(c).select('id,data,version');
      if (error) { console.warn(`load ${c} failed`, error.message); return; }
      const m = new Map<string, Doc>();
      for (const r of (data ?? []) as Row[]) m.set(r.id, toDoc(r));
      maps.set(c, m); loaded.add(c); emit(c);
    };
    void load();
    sb.channel(`qps-${c}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: c }, (p: { eventType: string; new: Row; old: { id?: string } }) => {
        const m = maps.get(c)!;
        if (p.eventType === 'DELETE') { if (p.old?.id) m.delete(p.old.id); }
        else if (p.new?.id) m.set(p.new.id, toDoc(p.new));
        emit(c);
      })
      .subscribe((status: string) => { if (status === 'SUBSCRIBED') void load(); });
  }

  async function write(coll: CollectionName, id: string, data: Record<string, unknown>, ifVersion: number | null, merge: boolean): Promise<Doc> {
    const { data: rows, error } = await sb.rpc('write_doc', { p_table: coll, p_id: id, p_data: data, p_if_version: ifVersion, p_merge: merge });
    if (error) {
      if (/version_conflict/.test(error.message) || error.code === '23505') throw new VersionConflictError();
      throw new Error(error.message);
    }
    const row = (Array.isArray(rows) ? rows[0] : rows) as { id: string; version: number } | undefined;
    if (!row) throw new MissingDocError();
    const cur = maps.get(coll)?.get(id);
    const doc: Doc = { id, version: row.version, data: merge && cur ? { ...cur.data, ...data } : data };
    // Reflect the write locally right away; the realtime event confirms it.
    if (!maps.has(coll)) maps.set(coll, new Map());
    maps.get(coll)!.set(id, doc);
    emit(coll);
    return doc;
  }

  async function getDoc(coll: CollectionName, id: string): Promise<Doc | null> {
    const { data, error } = await sb.from(coll).select('id,data,version').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? toDoc(data as Row) : null;
  }

  return {
    mode: 'supabase',
    subscribe(coll, cb) {
      let set = cbs.get(coll);
      if (!set) { set = new Set(); cbs.set(coll, set); }
      set.add(cb);
      start(coll);
      if (loaded.has(coll)) cb(list(coll));
      return () => { set!.delete(cb); };
    },
    get: getDoc,
    set: (coll, id, data) => write(coll, id, data, null, false),
    async update(coll, id, patch, opts: WriteOpts = {}) {
      const ver = opts.ifVersion ?? (await getDoc(coll, id))?.version;
      if (ver == null) throw new MissingDocError();
      return write(coll, id, patch, ver, true);
    },
    async replace(coll, id, data, opts: WriteOpts = {}) {
      const ver = opts.ifVersion ?? (await getDoc(coll, id))?.version;
      if (ver == null) throw new MissingDocError();
      return write(coll, id, data, ver, false);
    },
    async uploadFile(file, opts): Promise<UploadResult> {
      const safe = file.name.replace(/[^A-Za-z0-9._-]+/g, '_');
      const path = `${opts?.folder ?? 'uploads'}/${crypto.randomUUID()}-${safe}`;
      const { error } = await sb.storage.from('studio').upload(path, file, { contentType: file.type || undefined, upsert: false });
      if (error) throw new Error(error.message);
      return { id: path, path, size: file.size, name: file.name };
    },
    async signedUrl(pathOrId) {
      const { data, error } = await sb.storage.from('studio').createSignedUrl(pathOrId, 3600);
      if (error || !data) throw new Error(error?.message ?? 'no_url');
      return data.signedUrl;
    },
    async fireWorker(): Promise<FireResult> {
      try {
        const { data } = await sb.auth.getSession();
        const token = data.session?.access_token;
        if (!token) return { ok: false, error: 'signed_out' };
        const res = await fetch('/api/fire', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
        const body = (await res.json().catch(() => ({}))) as FireResult;
        return { ok: !!body.ok, sessionUrl: body.sessionUrl, error: body.error };
      } catch { return { ok: false, error: 'network' }; }
    },
    async user() { return auth.user; },
    auth: () => auth,
    onAuth(cb) { authCbs.add(cb); return () => { authCbs.delete(cb); }; },
    async signInWithEmail(email) {
      const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: window.location.origin } });
      return error ? { ok: false, error: error.message } : { ok: true };
    },
    async signOut() { await sb.auth.signOut(); },
  };
}
