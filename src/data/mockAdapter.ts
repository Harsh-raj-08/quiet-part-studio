import type { Adapter, AuthResult, AuthState, FireResult, UploadResult, WriteOpts } from './adapter';
import { MissingDocError, VersionConflictError } from './adapter';
import { COLLECTIONS, type CollectionName, type Doc, type StudioUser } from './types';

export interface FixtureDoc { id: string; data: Record<string, unknown>; version?: number }
export type Fixtures = Partial<Record<CollectionName, FixtureDoc[]>>;

export interface MockWrite { op: 'set' | 'update' | 'replace'; coll: CollectionName; id: string; data: Record<string, unknown>; ifVersion?: number; at: number }

export interface MockHandle {
  writes: MockWrite[];
  uploads: { id: string; name: string; size: number }[];
  fires: number;
  reset(): void;
  seed(f: Fixtures): void;
  /** Make the next write fail with a version conflict (tests the retry). */
  conflictNext(n?: number): void;
  failNext(message?: string): void;
  /** Sign out or in without a real provider (mock mode only), to show the login screen. */
  setSignedIn(on: boolean): void;
  /** Make the next link, password sign-in or password change fail with this kind. */
  failAuthNext(kind: NonNullable<AuthResult['kind']>): void;
  /** The last password accepted by updatePassword (so tests can sign in with it). */
  password: string;
  get(coll: CollectionName, id: string): Doc | null;
  list(coll: CollectionName): Doc[];
  /** Write as the worker would (not logged in `writes`): creates or merges, then notifies subscribers. */
  put(coll: CollectionName, id: string, data: Record<string, unknown>): void;
}

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** A 9:16 hatched SVG with the file name, standing in for a fixture image. */
function placeholderImage(p: string): string {
  const name = p.split('/').pop()!.replace(/[^A-Za-z0-9 ._-]/g, '').slice(0, 40);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='360' height='640' viewBox='0 0 360 640'><defs><pattern id='h' width='12' height='12' patternUnits='userSpaceOnUse' patternTransform='rotate(45)'><rect width='1' height='12' fill='#3a3733'/></pattern></defs><rect width='360' height='640' fill='#1e1c19'/><rect width='360' height='640' fill='url(#h)'/><text x='180' y='326' fill='#9a948a' font-family='monospace' font-size='16' text-anchor='middle'>${name}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function createMockAdapter(fixtures: Fixtures, mode: 'mock' | 'demo'): { adapter: Adapter; handle: MockHandle } {
  let base: Fixtures = fixtures;
  const store = new Map<CollectionName, Map<string, Doc>>();
  const listeners = new Map<CollectionName, Set<(d: Doc[]) => void>>();
  const files = new Map<string, File>();
  let conflicts = 0;
  let failMsg: string | null = null;
  const user: StudioUser = { id: 'mock-owner', email: 'owner@example.test' };
  let authState: AuthState = { status: 'signed-in', user, owner: true };
  const authCbs = new Set<(s: AuthState) => void>();
  const setAuth = (a: AuthState) => { authState = a; for (const cb of authCbs) cb(a); };
  let authFail: AuthResult['kind'] | null = null;
  const takeAuthFail = () => { const k = authFail; authFail = null; return k; };

  const handle: MockHandle = {
    writes: [], uploads: [], fires: 0,
    reset() { load(base); handle.writes.length = 0; handle.uploads.length = 0; handle.fires = 0; for (const c of COLLECTIONS) emit(c); },
    seed(f) { base = f; handle.reset(); },
    conflictNext(n = 1) { conflicts = n; },
    failNext(message = 'write_failed') { failMsg = message; },
    setSignedIn(on) { if (mode === 'mock') setAuth(on ? { status: 'signed-in', user, owner: true } : { status: 'signed-out', user: null, owner: false }); },
    failAuthNext(kind) { authFail = kind; },
    password: 'correct-horse-battery',
    get: (c, id) => { const d = store.get(c)?.get(id); return d ? clone(d) : null; },
    list: (c) => list(c).map(clone),
    put(c, id, data) {
      const m = store.get(c)!;
      const cur = m.get(id);
      m.set(id, { id, data: { ...(cur?.data ?? {}), ...clone(data) }, version: (cur?.version ?? 0) + 1 });
      emit(c);
    },
  };

  /** Row timestamps the real database keeps: faked from the document's own createdAt / updatedAt. */
  function fakeTimes(data: Record<string, unknown>): { createdAt?: string; updatedAt?: string } {
    const c = typeof data.createdAt === 'string' ? data.createdAt : typeof data.updatedAt === 'string' ? data.updatedAt : '';
    const u = typeof data.updatedAt === 'string' ? data.updatedAt : c;
    return { ...(c ? { createdAt: c } : {}), ...(u ? { updatedAt: u } : {}) };
  }
  function load(f: Fixtures) {
    store.clear();
    for (const c of COLLECTIONS) {
      const m = new Map<string, Doc>();
      for (const d of f[c] ?? []) m.set(d.id, { id: d.id, data: clone(d.data), version: d.version ?? 1, ...fakeTimes(d.data) });
      store.set(c, m);
    }
  }
  const list = (c: CollectionName): Doc[] => Array.from(store.get(c)?.values() ?? []).sort((a, b) => a.id.localeCompare(b.id));
  function emit(c: CollectionName) {
    const l = listeners.get(c);
    if (!l) return;
    const docs = list(c).map(clone);
    for (const cb of l) cb(docs);
  }
  function guard() {
    if (failMsg) { const m = failMsg; failMsg = null; throw new Error(m); }
  }
  function checkVersion(cur: Doc, opts?: WriteOpts) {
    if (conflicts > 0) { conflicts--; throw new VersionConflictError(); }
    if (opts?.ifVersion != null && cur.version !== opts.ifVersion) throw new VersionConflictError();
  }
  load(base);

  const adapter: Adapter = {
    mode,
    subscribe(coll, cb) {
      let set = listeners.get(coll);
      if (!set) { set = new Set(); listeners.set(coll, set); }
      set.add(cb);
      queueMicrotask(() => { if (set!.has(cb)) cb(list(coll).map(clone)); });
      return () => { set!.delete(cb); };
    },
    async get(coll, id) { const d = store.get(coll)?.get(id); return d ? clone(d) : null; },
    async set(coll, id, data) {
      guard();
      const m = store.get(coll)!;
      if (m.has(id)) throw new VersionConflictError('exists');
      const nowIso = new Date().toISOString();
      const d: Doc = { id, data: clone(data), version: 1, createdAt: nowIso, updatedAt: nowIso };
      m.set(id, d);
      handle.writes.push({ op: 'set', coll, id, data: clone(data), at: Date.now() });
      emit(coll);
      return clone(d);
    },
    async update(coll, id, patch, opts) {
      guard();
      const cur = store.get(coll)?.get(id);
      if (!cur) throw new MissingDocError();
      checkVersion(cur, opts);
      const d: Doc = { id, data: { ...cur.data, ...clone(patch) }, version: cur.version + 1, ...(cur.createdAt ? { createdAt: cur.createdAt } : {}), updatedAt: new Date().toISOString() };
      store.get(coll)!.set(id, d);
      handle.writes.push({ op: 'update', coll, id, data: clone(patch), ifVersion: opts?.ifVersion, at: Date.now() });
      emit(coll);
      return clone(d);
    },
    async replace(coll, id, data, opts) {
      guard();
      const cur = store.get(coll)?.get(id);
      if (!cur) throw new MissingDocError();
      checkVersion(cur, opts);
      const d: Doc = { id, data: clone(data), version: cur.version + 1, ...(cur.createdAt ? { createdAt: cur.createdAt } : {}), updatedAt: new Date().toISOString() };
      store.get(coll)!.set(id, d);
      handle.writes.push({ op: 'replace', coll, id, data: clone(data), ifVersion: opts?.ifVersion, at: Date.now() });
      emit(coll);
      return clone(d);
    },
    async uploadFile(file, opts): Promise<UploadResult> {
      guard();
      const id = `mock-${handle.uploads.length + 1}-${Math.random().toString(36).slice(2, 8)}`;
      const path = `${opts?.folder ?? 'uploads'}/${id}-${file.name}`;
      files.set(path, file);
      handle.uploads.push({ id: path, name: file.name, size: file.size });
      return { id: path, path, size: file.size, name: file.name };
    },
    async signedUrl(p) {
      const f = files.get(p);
      if (f) return URL.createObjectURL(f);
      // Fixture paths have no bytes behind them: images get a drawn stand-in, media get nothing (the UI shows its placeholder).
      return /\.(png|jpe?g|webp|gif)$/i.test(p) ? placeholderImage(p) : '';
    },
    async fireWorker(): Promise<FireResult> { handle.fires++; return { ok: true }; },
    async user() { return user; },
    auth: () => authState,
    onAuth(cb) { authCbs.add(cb); return () => { authCbs.delete(cb); }; },
    async signInWithEmail() { const k = takeAuthFail(); return k ? { ok: false, kind: k } : { ok: true }; },
    async signInWithPassword(email, password) {
      const k = takeAuthFail();
      if (k) return { ok: false, kind: k };
      if (password !== handle.password) return { ok: false, kind: 'invalid' };
      setAuth({ status: 'signed-in', user: { ...user, email }, owner: true });
      return { ok: true };
    },
    async updatePassword(password) {
      const k = takeAuthFail();
      if (k) return { ok: false, kind: k };
      if (password === handle.password) return { ok: false, kind: 'same' };
      handle.password = password;
      return { ok: true };
    },
    async signOut() { if (mode === 'mock') setAuth({ status: 'signed-out', user: null, owner: false }); },
  };
  return { adapter, handle };
}
