import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConflictError, handleWorker, safePath, tokenOk, UPLOAD_PATH_RE, READ_PATH_RE, type WDoc, type WorkerDb, type WorkerReq } from '../../api/_lib/worker-core';

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
      let l = [...tab(table).values()].filter((d) => where.every(([f, op, v]) => { const x = f === 'id' ? d.id : d.data[f]; return op === 'eq' ? String(x) === String(v) : op === 'neq' ? String(x) !== String(v) : true; }));
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
  assert.equal((await w('jobs', 'new', { status: 'queued' })).body.error, 'job_not_found');
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
