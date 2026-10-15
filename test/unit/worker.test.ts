import { test } from 'node:test';
import assert from 'node:assert/strict';
import { claimOrder, ConflictError, ensureWeekly, handleWorker, istDay, safePath, tokenOk, UPLOAD_PATH_RE, READ_PATH_RE, type WDoc, type WorkerDb, type WorkerReq } from '../../api/_lib/worker-core';

/** In-memory WorkerDb with write_doc semantics. */
function fakeDb(seed: Record<string, WDoc[]> = {}) {
  const t = new Map<string, Map<string, WDoc>>();
  for (const [k, l] of Object.entries(seed)) t.set(k, new Map(l.map((d) => [d.id, structuredClone(d)])));
  const tab = (n: string) => { if (!t.has(n)) t.set(n, new Map()); return t.get(n)!; };
  const writes: { table: string; id: string; data: Record<string, unknown> }[] = [];
  let conflictOnce = false;
  const db: WorkerDb = {
    async get(table, id) { const d = tab(table).get(id); return d ? structuredClone(d) : null; },
    async query(table, where, orderBy, limit) {
      let l = [...tab(table).values()].filter((d) => where.every(([f, op, v]) => { const x = f === 'id' ? d.id : d.data[f]; const c = String(x ?? '').localeCompare(String(v)); return op === 'eq' ? String(x) === String(v) : op === 'neq' ? String(x) !== String(v) : op === 'gte' ? x != null && c >= 0 : op === 'gt' ? x != null && c > 0 : op === 'lte' ? x != null && c <= 0 : op === 'lt' ? x != null && c < 0 : op === 'in' ? (v as unknown[]).map(String).includes(String(x)) : true; }));
      if (orderBy) l = l.sort((a, b) => String(a.data[orderBy.field]).localeCompare(String(b.data[orderBy.field])) * (orderBy.dir === 'desc' ? -1 : 1));
      return structuredClone(l.slice(0, limit));
    },
    async write(table, id, data, ifVersion, merge) {
      const m = tab(table); const cur = m.get(id);
      if (conflictOnce) { conflictOnce = false; throw new ConflictError(); }
      if (ifVersion == null) { if (cur) throw new ConflictError(); m.set(id, { id, data, version: 1 }); writes.push({ table, id, data }); return { id, version: 1 }; }
      if (!cur || cur.version !== ifVersion) throw new ConflictError();
      const next = { id, data: merge ? { ...cur.data, ...data } : data, version: cur.version + 1 };
      m.set(id, next); writes.push({ table, id, data });
      return { id, version: next.version };
    },
    async signedDownload(p, s) { return `https://files.example/${p}?e=${s}`; },
    async signedUpload(p) { return { url: `https://files.example/upload/${p}`, token: 'up' }; },
  };
  return { db, tab, writes, conflict: () => { conflictOnce = true; } };
}
const NOW = Date.parse('2026-10-11T06:30:00Z');
const call = (f: ReturnType<typeof fakeDb>, action: string, body: unknown, o: Partial<WorkerReq> = {}, token = 'secret-worker-token') =>
  handleWorker({ method: 'POST', action, contentType: 'application/json', body: body === undefined ? '' : JSON.stringify(body), token, ...o }, { workerToken: 'secret-worker-token', db: f.db, now: () => NOW, runId: () => 'run-1' });

test('worker auth: POST only, 503 without config, constant-time bearer check, JSON only, 1 MB cap', async () => {
  const f = fakeDb();
  assert.equal((await call(f, 'heartbeat', {}, { method: 'GET' })).status, 405);
  assert.equal((await handleWorker({ method: 'POST', action: 'heartbeat', contentType: 'application/json', body: '{}', token: 'x' }, { workerToken: undefined, db: f.db, now: () => NOW })).status, 503);
  assert.equal((await handleWorker({ method: 'POST', action: 'heartbeat', contentType: 'application/json', body: '{}', token: 'x' }, { workerToken: 't', db: null, now: () => NOW })).status, 503);
  assert.equal((await call(f, 'heartbeat', {}, {}, 'wrong')).status, 401);
  assert.equal((await call(f, 'heartbeat', {}, {}, null as unknown as string)).status, 401);
  assert.equal((await call(f, 'heartbeat', {}, { contentType: 'text/plain' })).status, 415);
  assert.equal((await call(f, 'heartbeat', {}, { body: 'x'.repeat(1024 * 1024 + 1) })).status, 413);
  assert.equal((await call(f, 'get', {}, { body: '[1,2]' })).status, 400);
  assert.equal((await call(f, 'nope', {})).status, 404);
  assert.equal(tokenOk('abc', 'abc'), true); assert.equal(tokenOk('abcd', 'abc'), false); assert.equal(tokenOk('', 'abc'), false);
  assert.equal(f.writes.length, 0, 'nothing written by refused calls');
});

test('next claims the oldest queued job atomically (skips one lost to a race) and records the heartbeat', async () => {
  const f = fakeDb({ jobs: [
    { id: 'b', version: 1, data: { node: 'writer', status: 'queued', createdAt: '2026-10-11T02:00:00Z' } },
    { id: 'a', version: 1, data: { node: 'scout', status: 'queued', createdAt: '2026-10-11T01:00:00Z' } },
    { id: 'c', version: 3, data: { node: 'qa', status: 'done', createdAt: '2026-10-10T01:00:00Z' } },
  ] });
  f.conflict(); // the first claim loses a race (another worker took it)... the heartbeat absorbs it once
  let r = await call(f, 'next', {});
  assert.equal(r.status, 200);
  const job = r.body.job as { id: string; data: Record<string, unknown> };
  assert.equal(job.id, 'a'); assert.equal(job.data.status, 'running'); assert.equal(job.data.runId, 'run-1');
  assert.equal(f.tab('jobs').get('a')!.data.status, 'running');
  assert.equal(f.tab('settings').get('studio')!.data.workerSeenAt, new Date(NOW).toISOString());
  r = await call(f, 'next', {}); assert.equal((r.body.job as { id: string }).id, 'b');
  r = await call(f, 'next', {}); assert.equal(r.body.job, null);
});

test('get / query: whitelisted tables, validated filters, limit ≤ 100', async () => {
  const f = fakeDb({ ideas: [{ id: 'AH-01', version: 2, data: { code: 'AH-01', status: 'Posted' } }] });
  assert.equal(((await call(f, 'get', { table: 'ideas', id: 'AH-01' })).body.doc as WDoc).version, 2);
  assert.equal((await call(f, 'get', { table: 'studio_owner', id: 'x' })).status, 403);
  assert.equal((await call(f, 'get', { table: 'ideas', id: '../x' })).status, 400);
  assert.equal(((await call(f, 'query', { table: 'ideas', where: [['status', 'eq', 'Posted']], orderBy: 'code', limit: 5 })).body.docs as WDoc[]).length, 1);
  assert.equal((await call(f, 'query', { table: 'ideas', limit: 101 })).status, 400);
  assert.equal((await call(f, 'query', { table: 'ideas', where: [["status; drop", 'eq', 1]] })).status, 400);
  assert.equal((await call(f, 'query', { table: 'ideas', where: [['status', 'like', 'x']] })).status, 400);
  assert.equal((await call(f, 'query', { table: 'auth.users' })).status, 403);
});

test('write whitelist: free tables, metrics append-only, own job fields only, books/chats/playbooks/settings limits, never ratings', async () => {
  const f = fakeDb({
    jobs: [{ id: 'j1', version: 2, data: { status: 'running', runId: 'run-1', node: 'writer' } }, { id: 'j2', version: 1, data: { status: 'queued' } }],
    metrics: [{ id: 'AH-01', version: 1, data: { ideaCode: 'AH-01', snapshots: [{ day: 1 }] } }],
    books: [{ id: 'atomic-habits', version: 1, data: { title: 'Atomic Habits' } }],
    chats: [{ id: 'c1', version: 1, data: { turns: [{ role: 'user', content: 'q' }] } }],
  });
  const w = (table: string, id: string, data: unknown, extra: Record<string, unknown> = {}) => call(f, 'write', { table, id, data, ...extra });
  assert.equal((await w('packs', 'AH-01-v2', { ideaCode: 'AH-01', version: 2 })).status, 200);
  assert.equal((await w('packs', 'AH-01-v2', { ideaCode: 'AH-01' })).status, 409, 'insert over an existing id');
  assert.equal((await w('packs', 'AH-01-v2', { title: 'T' }, { merge: true, ifVersion: 1 })).status, 200);
  assert.equal((await w('packs', 'AH-01-v2', { title: 'T' }, { merge: true, ifVersion: 1 })).status, 409, 'stale version');
  assert.equal((await w('ratings', 'x', { score: 10 })).status, 403);
  assert.equal((await w('studio_owner', 'x', {})).status, 403);
  // metrics
  assert.equal((await w('metrics', 'AH-01', { snapshots: [{ day: 1 }, { day: 7 }], latest: { day: 7 } }, { merge: true })).status, 200);
  assert.equal((await w('metrics', 'AH-01', { snapshots: [{ day: 7 }] }, { merge: true })).body.error, 'metrics_append_only');
  assert.equal((await w('metrics', 'AH-01', { snapshots: [] })).body.error, 'metrics_append_only');
  assert.equal((await w('metrics', 'PM-01', { ideaCode: 'PM-01', snapshots: [] })).status, 200, 'new metrics doc');
  // jobs
  assert.equal((await w('jobs', 'j1', { status: 'done', finishedAt: 'x', progress: { step: 1, of: 2, label: 'l' } }, { merge: true, runId: 'run-1' })).status, 200);
  assert.equal((await w('jobs', 'j2', { status: 'done' }, { merge: true, runId: 'run-1' })).body.error, 'not_your_job');
  assert.equal((await w('jobs', 'j1', { node: 'scout' }, { merge: true, runId: 'run-1' })).body.error, 'field_not_writable');
  assert.equal((await w('jobs', 'new', { status: 'queued' })).body.error, 'only_art_jobs', 'non-art job inserts are refused');
  assert.equal((await w('jobs', 'new', { node: 'scout', status: 'queued', createdBy: 'worker' })).body.error, 'only_art_jobs');
  assert.equal((await w('jobs', 'new', { node: 'art', status: 'queued' }, { merge: true })).body.error, 'job_not_found');
  // books
  assert.equal((await w('books', 'atomic-habits', { topic: 'Habits', status: 'Done', summary: 's' }, { merge: true })).status, 200);
  assert.equal((await w('books', 'atomic-habits', { title: 'Other' }, { merge: true })).body.error, 'field_not_writable');
  // chats
  assert.equal((await w('chats', 'c1', { turns: [{ role: 'user', content: 'q' }, { role: 'assistant', content: 'a' }], updatedAt: 'x' }, { merge: true })).status, 200);
  assert.equal((await w('chats', 'c1', { turns: [{ role: 'assistant', content: 'rewritten' }] }, { merge: true })).body.error, 'turns_append_only');
  assert.equal((await w('chats', 'c1', { turns: [{ role: 'user', content: 'q' }, { role: 'assistant', content: 'a' }, { role: 'user', content: 'fake' }] }, { merge: true })).body.error, 'assistant_turns_only');
  assert.equal((await w('chats', 'c1', { title: 'x' }, { merge: true })).body.error, 'field_not_writable');
  // playbooks + settings
  assert.equal((await w('playbooks', 'learnings-proposed', { text: '- [early] x' })).status, 200);
  assert.equal((await w('playbooks', 'learnings', { text: 'x' })).body.error, 'playbook_not_writable');
  assert.equal((await w('playbooks', 'taste-profile', { text: 'x' })).body.error, 'playbook_not_writable');
  assert.equal((await w('settings', 'studio', { workerSeenAt: 'x' }, { merge: true })).status, 200);
  assert.equal((await w('settings', 'studio', { workerTriggerId: 'x' }, { merge: true })).body.error, 'field_not_writable');
  assert.equal((await w('settings', 'other', { workerSeenAt: 'x' })).body.error, 'settings_not_writable');
});

test('file paths: download any safe studio path; upload only under media/, frames/ or exports/; never ..', async () => {
  const f = fakeDb();
  assert.match(String((await call(f, 'file-url', { path: 'books/atomic-habits/x.pdf' })).body.url), /e=600$/);
  assert.equal((await call(f, 'file-url', { path: 'books/../secret' })).status, 400);
  assert.equal((await call(f, 'upload-url', { path: 'frames/SH-01/f1.png' })).status, 200);
  for (const p of ['books/x.pdf', 'media/../x', 'media//x', '/media/x', 'media/x y.mp4', 'exports/./x', 'media/a\\b']) assert.equal((await call(f, 'upload-url', { path: p })).status, 400, p);
  assert.equal(safePath('media/SH-01/voice-1.m4a', UPLOAD_PATH_RE), true);
  assert.equal(safePath('stats/PM-01/a.png', READ_PATH_RE), true);
});

const MON = Date.parse('2026-10-11T19:00:00Z'); // Monday 00:30 in Asia/Kolkata (still Sunday in UTC)
const callAt = (f: ReturnType<typeof fakeDb>, now: number, action: string, body: unknown) =>
  handleWorker({ method: 'POST', action, contentType: 'application/json', body: JSON.stringify(body), token: 'secret-worker-token' }, { workerToken: 'secret-worker-token', db: f.db, now: () => now, runId: () => 'run-1' });

test('Monday in Asia/Kolkata: next inserts the weekly scout/trends/review jobs once, skipping nodes run in the last 6 days', async () => {
  assert.deepEqual(istDay(MON), { date: '2026-10-12', weekday: 1 });
  assert.equal(istDay(NOW).weekday, 0, 'the fixed test clock is a Sunday');
  const f = fakeDb({ jobs: [{ id: 'trends-old', version: 2, data: { node: 'trends', status: 'done', createdAt: '2026-10-08T03:00:00Z' } }] });
  const r = await callAt(f, MON, 'next', {});
  assert.equal(r.status, 200);
  assert.equal(f.tab('jobs').get('scout-2026-10-12')?.data.createdBy, 'schedule');
  assert.equal(f.tab('jobs').get('review-2026-10-12')?.data.request, 'Weekly review');
  assert.equal(f.tab('jobs').get('scout-2026-10-12')?.data.request, 'Weekly run');
  assert.equal(f.tab('jobs').has('trends-2026-10-12'), false, 'trends ran 4 days ago');
  assert.equal((r.body.job as WDoc).id, 'scout-2026-10-12', 'scout claimed before review');
  // A second pass the same day adds nothing (insert-only, and the 6-day window sees today's jobs).
  const before = f.tab('jobs').size;
  assert.deepEqual(await ensureWeekly(f.db, MON + 3600_000), []);
  assert.equal(f.tab('jobs').size, before);
  // Not Monday: nothing.
  assert.deepEqual(await ensureWeekly(fakeDb().db, NOW), []);
  // An existing id is a conflict, ignored.
  const g = fakeDb({ jobs: [{ id: 'review-2026-10-12', version: 1, data: { node: 'review', status: 'done' } }] });
  assert.deepEqual(await ensureWeekly(g.db, MON), ['scout-2026-10-12', 'trends-2026-10-12']);
});

test('claim order: oldest first, review and taste last', () => {
  const j = (id: string, node: string, createdAt: string): WDoc => ({ id, version: 1, data: { node, createdAt, status: 'queued' } });
  assert.deepEqual(claimOrder([j('r', 'review', '2026-10-01'), j('t', 'taste', '2026-10-02'), j('w2', 'writer', '2026-10-05'), j('w1', 'research', '2026-10-03')]).map((x) => x.id), ['w1', 'w2', 'r', 't']);
});

test('worker may insert exactly one kind of job: a queued art job for an existing pack, with auto-art on and none pending', async () => {
  const f = fakeDb({ packs: [{ id: 'SH-01-v2', version: 1, data: {} }, { id: 'SH-02-v1', version: 1, data: {} }], settings: [{ id: 'studio', version: 1, data: {} }] });
  const art = (id: string, data: Record<string, unknown>) => call(f, 'write', { table: 'jobs', id, data });
  const ok = { node: 'art', status: 'queued', packId: 'SH-01-v2', ideaCode: 'SH-01', createdBy: 'worker', request: 'Frames for the new pack' };
  const r = await art('art-SH-01-v2', ok);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(f.tab('jobs').get('art-SH-01-v2')?.data.createdAt, new Date(NOW).toISOString(), 'server stamps createdAt');
  assert.equal((await art('art-SH-01-v2-b', ok)).body.error, 'art_job_pending');
  assert.equal((await art('x1', { ...ok, packId: 'NOPE-v1' })).body.error, 'pack_not_found');
  assert.equal((await art('x2', { ...ok, packId: 'SH-02-v1', status: 'running' })).body.error, 'only_art_jobs');
  assert.equal((await art('x3', { ...ok, packId: 'SH-02-v1', createdBy: 'owner' })).body.error, 'only_art_jobs');
  assert.equal((await art('x4', { ...ok, packId: 'SH-02-v1', runId: 'r' })).body.error, 'field_not_writable');
  assert.equal((await art('art-SH-01-v2', { status: 'queued' })).body.error, 'merge_required', 'existing job: normal job rules');
  f.tab('jobs').get('art-SH-01-v2')!.data.status = 'done';
  f.tab('settings').get('studio')!.data.autoArt = false;
  assert.equal((await art('x5', ok)).body.error, 'auto_art_off');
  f.tab('settings').get('studio')!.data.autoArt = true;
  assert.equal((await art('art-SH-01-v2-2', ok)).status, 200, 'allowed again once the earlier art job is done');
});
