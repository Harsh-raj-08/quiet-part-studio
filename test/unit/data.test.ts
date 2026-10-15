import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMockAdapter } from '../../src/data/mockAdapter';
import { Store } from '../../src/data/store';
import { moveIdea, queueJob } from '../../src/data/actions';
import { handleFire, pickSessionUrl, type FireDeps } from '../../api/_lib/fire-core';
import { bearer } from '../../api/_lib/auth';

const fx = { ideas: [{ id: 'A-1', data: { status: 'Idea', history: [{ status: 'Idea', at: 'x' }] } }] };

test('moveIdea: fresh get, history append, version bump', async () => {
  const { adapter } = createMockAdapter(fx, 'mock');
  const store = new Store(adapter);
  const r = await moveIdea(store, 'A-1', 'Approved', null, () => 't1');
  assert.equal(r.changed, true);
  const d = (await adapter.get('ideas', 'A-1'))!;
  assert.equal(d.version, 2);
  assert.deepEqual(d.data.history, [{ status: 'Idea', at: 'x' }, { status: 'Approved', at: 't1' }]);
  assert.equal((await moveIdea(store, 'A-1', 'Approved')).changed, false);
});

test('moveIdea: a version conflict is re-read and retried once; a second conflict surfaces', async () => {
  const { adapter, handle } = createMockAdapter(fx, 'mock');
  const store = new Store(adapter);
  handle.conflictNext(1);
  await moveIdea(store, 'A-1', 'Approved');
  assert.equal(handle.get('ideas', 'A-1')!.data.status, 'Approved');
  handle.conflictNext(2);
  await assert.rejects(() => moveIdea(store, 'A-1', 'Scripted'), (e: { code?: string }) => e.code === 'version_conflict');
});

test('concurrent worker write is not lost by a history append', async () => {
  const { adapter } = createMockAdapter(fx, 'mock');
  const store = new Store(adapter);
  await adapter.update('ideas', 'A-1', { hookStyle: 'story' });
  await moveIdea(store, 'A-1', 'Approved');
  assert.equal((await adapter.get('ideas', 'A-1'))!.data.hookStyle, 'story');
});

test('mock adapter: subscribe delivers the list then changes; set refuses an existing id; reset restores', async () => {
  const { adapter, handle } = createMockAdapter(fx, 'mock');
  const seen: number[] = [];
  adapter.subscribe('ideas', (d) => seen.push(d.length));
  await new Promise((r) => setTimeout(r, 5));
  await adapter.set('ideas', 'B-1', { status: 'Idea' });
  await assert.rejects(() => adapter.set('ideas', 'B-1', {}));
  assert.deepEqual(seen, [1, 2]);
  handle.reset();
  assert.equal(handle.list('ideas').length, 1);
});

test('queueJob writes a queued job doc', async () => {
  const { adapter, handle } = createMockAdapter({}, 'mock');
  const id = await queueJob(new Store(adapter), { node: 'writer', request: 'Write production pack', ideaCode: 'A-1' });
  assert.match(id, /^writer-A-1-\d+-[a-z0-9]{1,4}$/);
  const j = handle.get('jobs', id)!;
  assert.equal(j.data.status, 'queued');
  assert.equal(j.data.ideaCode, 'A-1');
});

const deps = (o: Partial<FireDeps> = {}): FireDeps => ({
  token: 't', verifyOwner: async () => true, configured: true, readSettings: async () => ({ version: 3, lastFireAt: null }), writeLastFire: async () => 'ok', post: async () => ({ ok: true, body: { claude_code_session_url: 'https://claude.ai/code/session_1' } }), now: () => 1_000_000, ...o,
});

test('api/fire: auth, owner, debounce, success, failure', async () => {
  assert.equal((await handleFire(deps({ token: null }))).status, 401);
  assert.equal((await handleFire(deps({ verifyOwner: async () => false }))).status, 403);
  assert.equal((await handleFire(deps({ readSettings: async () => ({ version: 3, lastFireAt: 1_000_000 - 59_000 }) }))).status, 429);
  const ok = await handleFire(deps({ readSettings: async () => ({ version: 3, lastFireAt: 1_000_000 - 61_000 }) }));
  assert.deepEqual(ok, { status: 200, body: { ok: true, sessionUrl: 'https://claude.ai/code/session_1' } });
  assert.equal((await handleFire(deps({ post: async () => ({ ok: false, body: null }) }))).status, 502);
  assert.equal((await handleFire(deps({ post: async () => { throw new Error('secret-token-xyz'); } }))).body.error, 'fire_failed');
  assert.equal(pickSessionUrl({ url: 'http://insecure' }), undefined);
  assert.equal(bearer({ headers: { authorization: 'Bearer abc' } }), 'abc');
  assert.equal(bearer({ headers: {} }), null);
});

test('supabase adapter: a missing optional table (account before 0002) reads as empty and stops listening', async () => {
  const { createSupabaseAdapter, isMissingTable } = await import('../../src/data/supabaseAdapter');
  const removed: string[] = [];
  const chan = (name: string) => { const c = { name, on: () => c, subscribe: () => c }; return c; };
  const fake = {
    auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
    from: (t: string) => ({ select: async () => (t === 'account'
      ? { data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.account' in the schema cache" } }
      : { data: [{ id: 'A-1', data: { status: 'Idea' }, version: 2 }], error: null }) }),
    channel: chan,
    removeChannel: async (c: { name: string }) => { removed.push(c.name); },
  };
  const a = createSupabaseAdapter({ supabaseUrl: 'https://x.invalid', supabaseAnonKey: 'k' } as never, fake as never);
  const acct = await new Promise<unknown[]>((res) => a.subscribe('account', res));
  assert.deepEqual(acct, []);
  assert.deepEqual(removed, ['qps-account']);
  const ideas = await new Promise<{ id: string }[]>((res) => a.subscribe('ideas', res as never));
  assert.equal(ideas[0].id, 'A-1');
  assert.equal(isMissingTable({ code: '42P01', message: 'relation "public.account" does not exist' }), true);
  assert.equal(isMissingTable({ code: '42501', message: 'permission denied' }), false);
});

test('api/fire: who is asking is checked before config is revealed; the rate limit is versioned and fails closed', async () => {
  // Missing service client: 401 without a token, 503 with one (nobody can be verified).
  assert.equal((await handleFire(deps({ token: null, verifyOwner: null }))).status, 401);
  assert.equal((await handleFire(deps({ verifyOwner: null }))).body.error, 'not_configured');
  // Routine not configured: only the owner learns that.
  assert.equal((await handleFire(deps({ configured: false, verifyOwner: async () => false }))).status, 403);
  assert.equal((await handleFire(deps({ configured: false }))).body.error, 'not_configured');
  // Versioned claim: the write uses the version that was read; losing the race is 429; any other failure is 503 and nothing is posted.
  let seen: number | null | undefined; let posted = 0;
  const post = async () => { posted++; return { ok: true, body: {} }; };
  assert.equal((await handleFire(deps({ writeLastFire: async (_iso, v) => { seen = v; return 'ok'; }, post }))).status, 200);
  assert.equal(seen, 3);
  assert.equal((await handleFire(deps({ readSettings: async () => null, writeLastFire: async (_iso, v) => { seen = v; return 'ok'; }, post }))).status, 200);
  assert.equal(seen, null, 'no settings doc yet: insert');
  posted = 0;
  assert.deepEqual((await handleFire(deps({ writeLastFire: async () => 'conflict', post }))).body, { ok: false, error: 'too_soon' });
  assert.equal((await handleFire(deps({ writeLastFire: async () => 'error', post }))).status, 503);
  assert.equal((await handleFire(deps({ writeLastFire: async () => { throw new Error('x'); }, post }))).status, 503);
  assert.equal((await handleFire(deps({ readSettings: async () => { throw new Error('db down'); }, post }))).status, 503);
  assert.equal(posted, 0);
});
