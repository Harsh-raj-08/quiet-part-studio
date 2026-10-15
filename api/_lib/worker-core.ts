// Pure core of the Worker API (api/worker/[action].ts). Storage and database access are injected as `WorkerDb`,
// so the rules (auth, table and field allowlists, path checks) are unit-tested without a network.
import { createHash, timingSafeEqual } from 'node:crypto';

export interface WDoc { id: string; data: Record<string, unknown>; version: number }
export type Op = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in';
export interface WorkerDb {
  get(table: string, id: string): Promise<WDoc | null>;
  query(table: string, where: [string, Op, unknown][], orderBy: { field: string; dir: 'asc' | 'desc' } | null, limit: number): Promise<WDoc[]>;
  /** write_doc semantics: ifVersion null = insert (conflict if it exists); else versioned update, merged when `merge`. */
  write(table: string, id: string, data: Record<string, unknown>, ifVersion: number | null, merge: boolean): Promise<{ id: string; version: number }>;
  signedDownload(path: string, seconds: number): Promise<string>;
  signedUpload(path: string): Promise<{ url: string; token?: string }>;
}
export class ConflictError extends Error { code = 'version_conflict'; }

export interface WorkerReq { method: string; action: string; contentType: string; body: string | null; token: string | null }
export interface WorkerEnv { workerToken: string | undefined; db: WorkerDb | null; now: () => number; runId?: () => string }
export interface WorkerOut { status: number; body: Record<string, unknown> }

export const MAX_BODY = 1024 * 1024;
export const READ_TABLES = new Set(['books', 'booknotes', 'ideas', 'packs', 'posts', 'jobs', 'runs', 'reports', 'qa', 'metrics', 'chats', 'ratings', 'playbooks', 'settings', 'account']);
const FREE_WRITE = new Set(['ideas', 'packs', 'posts', 'reports', 'qa', 'runs', 'booknotes', 'account']);
const JOB_FIELDS = new Set(['status', 'progress', 'result', 'error', 'finishedAt']);
const BOOK_FIELDS = new Set(['topic', 'status', 'summary', 'digest', 'notesCount', 'researchedAt', 'updatedAt']);
const METRIC_FIELDS = new Set(['snapshots', 'screenshots', 'latest', 'updatedAt', 'ideaCode', 'postedAt']);
const PLAYBOOK_IDS = new Set(['learnings-proposed', 'taste-proposed']);
const OPS = new Set<Op>(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in']);
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const FIELD_RE = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
/** Any studio file the worker may read (download URL). */
export const READ_PATH_RE = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,400}$/;
/** Where the worker may upload. */
export const UPLOAD_PATH_RE = /^(media|frames|exports)\/[A-Za-z0-9._/-]+$/;

export function safePath(p: unknown, re: RegExp): p is string {
  return typeof p === 'string' && re.test(p) && !p.split('/').some((s) => s === '..' || s === '.' || s === '') && p.length <= 400;
}

/** Constant-time token check (hash both sides so lengths never leak). */
export function tokenOk(given: string | null, expected: string): boolean {
  if (!given) return false;
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const err = (status: number, error: string, extra: Record<string, unknown> = {}): WorkerOut => ({ status, body: { ok: false, error, ...extra } });
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
/** True when `next` keeps every item of `prev`, in order, and only adds at the end. */
const appendOnly = (prev: unknown, next: unknown) => Array.isArray(next) && (prev == null || (Array.isArray(prev) && prev.length <= next.length && prev.every((x, i) => same(x, next[i]))));

async function heartbeat(db: WorkerDb, now: number): Promise<void> {
  const at = new Date(now).toISOString();
  for (let k = 0; k < 2; k++) {
    const cur = await db.get('settings', 'studio');
    try {
      if (cur) await db.write('settings', 'studio', { workerSeenAt: at }, cur.version, true);
      else await db.write('settings', 'studio', { workerSeenAt: at }, null, false);
      return;
    } catch (e) { if (!(e instanceof ConflictError) || k) throw e; }
  }
}

const ART_JOB_FIELDS = new Set(['node', 'status', 'packId', 'ideaCode', 'createdBy', 'createdAt', 'request']);
export const WEEKLY_NODES = ['scout', 'trends', 'review'] as const;
const DAY = 86_400_000;
const IST = 330 * 60_000;
/** Today's date and weekday in Asia/Kolkata (fixed +05:30, no DST). */
export function istDay(now: number): { date: string; weekday: number } {
  const d = new Date(now + IST);
  return { date: d.toISOString().slice(0, 10), weekday: d.getUTCDay() };
}

/** Monday (IST): queue the weekly scout/trends/review runs the old worker used to create, unless one was created in the last 6 days. Insert-only. */
export async function ensureWeekly(db: WorkerDb, now: number): Promise<string[]> {
  const { date, weekday } = istDay(now);
  if (weekday !== 1) return [];
  const since = new Date(now - 6 * DAY).toISOString();
  const made: string[] = [];
  for (const node of WEEKLY_NODES) {
    const recent = await db.query('jobs', [['node', 'eq', node], ['createdAt', 'gte', since]], null, 1);
    if (recent.length) continue;
    const id = `${node}-${date}`;
    try {
      await db.write('jobs', id, { node, request: node === 'review' ? 'Weekly review' : 'Weekly run', status: 'queued', createdAt: new Date(now).toISOString(), createdBy: 'schedule' }, null, false);
      made.push(id);
    } catch (e) { if (!(e instanceof ConflictError)) throw e; }
  }
  return made;
}

/** Claim order: oldest first, but review and taste jobs after everything else (they read what the others write). */
export function claimOrder(jobs: WDoc[]): WDoc[] {
  const late = (j: WDoc) => (j.data.node === 'review' || j.data.node === 'taste' ? 1 : 0);
  return [...jobs].sort((a, b) => late(a) - late(b) || String(a.data.createdAt ?? '').localeCompare(String(b.data.createdAt ?? '')) || a.id.localeCompare(b.id));
}

/** The one job a worker may create: an art job for an existing pack, when auto-art is on and none is pending for that pack. */
export async function artJobRule(db: WorkerDb, data: Record<string, unknown>): Promise<string | null> {
  if (Object.keys(data).some((k) => !ART_JOB_FIELDS.has(k))) return 'field_not_writable';
  if (data.node !== 'art' || data.status !== 'queued' || data.createdBy !== 'worker') return 'only_art_jobs';
  if (typeof data.packId !== 'string' || !ID_RE.test(data.packId)) return 'bad_pack';
  if (!(await db.get('packs', data.packId))) return 'pack_not_found';
  const set = await db.get('settings', 'studio');
  if (set && set.data.autoArt === false) return 'auto_art_off';
  const pending = await db.query('jobs', [['node', 'eq', 'art'], ['packId', 'eq', data.packId]], null, 100);
  if (pending.some((j) => j.data.status === 'queued' || j.data.status === 'running')) return 'art_job_pending';
  return null;
}

/** The per-table write rules. Returns an error string, or null when the write is allowed. */
export function writeRule(table: string, id: string, data: Record<string, unknown>, cur: WDoc | null, merge: boolean, runId: unknown): string | null {
  const keys = Object.keys(data);
  if (table === 'ratings') return 'table_not_writable';
  if (FREE_WRITE.has(table)) return null;
  if (table === 'metrics') {
    if (!cur) return null;
    if (!merge) return 'metrics_append_only';
    if (keys.some((k) => !METRIC_FIELDS.has(k))) return 'field_not_writable';
    if ('snapshots' in data && !appendOnly(cur.data.snapshots, data.snapshots)) return 'metrics_append_only';
    if ('screenshots' in data && !appendOnly(cur.data.screenshots, data.screenshots)) return 'metrics_append_only';
    if ('ideaCode' in data && cur.data.ideaCode != null && data.ideaCode !== cur.data.ideaCode) return 'field_not_writable';
    return null;
  }
  if (table === 'jobs') {
    if (!cur) return 'job_not_found';
    if (!merge) return 'merge_required';
    if (keys.some((k) => !JOB_FIELDS.has(k))) return 'field_not_writable';
    if (cur.data.status !== 'running' || !runId || cur.data.runId !== runId) return 'not_your_job';
    if ('status' in data && !['running', 'done', 'failed'].includes(String(data.status))) return 'bad_status';
    return null;
  }
  if (table === 'books') {
    if (!cur) return 'book_not_found';
    if (!merge) return 'merge_required';
    return keys.some((k) => !BOOK_FIELDS.has(k)) ? 'field_not_writable' : null;
  }
  if (table === 'chats') {
    if (!cur) return 'chat_not_found';
    if (!merge) return 'merge_required';
    if (keys.some((k) => k !== 'turns' && k !== 'updatedAt')) return 'field_not_writable';
    if ('turns' in data) {
      if (!appendOnly(cur.data.turns, data.turns)) return 'turns_append_only';
      const added = (data.turns as unknown[]).slice(Array.isArray(cur.data.turns) ? cur.data.turns.length : 0);
      if (added.some((t) => !isObj(t) || t.role !== 'assistant')) return 'assistant_turns_only';
    }
    return null;
  }
  if (table === 'playbooks') return PLAYBOOK_IDS.has(id) ? null : 'playbook_not_writable';
  if (table === 'settings') {
    if (id !== 'studio') return 'settings_not_writable';
    if (cur && !merge) return 'merge_required';
    return keys.length && keys.every((k) => k === 'workerSeenAt') ? null : 'field_not_writable';
  }
  return 'table_not_writable';
}

export async function handleWorker(r: WorkerReq, env: WorkerEnv): Promise<WorkerOut> {
  if (r.method !== 'POST') return err(405, 'method_not_allowed');
  if (!env.workerToken || !env.db) return err(503, 'not_configured');
  if (!tokenOk(r.token, env.workerToken)) return err(401, 'unauthorized');
  if (!/^application\/json\b/i.test(r.contentType || '')) return err(415, 'json_only');
  if (r.body != null && Buffer.byteLength(r.body) > MAX_BODY) return err(413, 'too_large');
  let b: Record<string, unknown> = {};
  if (r.body && r.body.trim()) {
    try { const p = JSON.parse(r.body); if (!isObj(p)) return err(400, 'bad_json'); b = p; } catch { return err(400, 'bad_json'); }
  }
  const db = env.db;
  const now = env.now();
  try {
    switch (r.action) {
      case 'heartbeat': {
        await heartbeat(db, now);
        return { status: 200, body: { ok: true, workerSeenAt: new Date(now).toISOString() } };
      }
      case 'next': {
        await heartbeat(db, now);
        await ensureWeekly(db, now);
        const queued = claimOrder(await db.query('jobs', [['status', 'eq', 'queued']], { field: 'createdAt', dir: 'asc' }, 100));
        for (const j of queued) {
          const runId = env.runId ? env.runId() : `run-${now}-${Math.random().toString(36).slice(2, 8)}`;
          try {
            const w = await db.write('jobs', j.id, { status: 'running', startedAt: new Date(now).toISOString(), runId }, j.version, true);
            return { status: 200, body: { ok: true, job: { id: j.id, version: w.version, data: { ...j.data, status: 'running', startedAt: new Date(now).toISOString(), runId } }, runId } };
          } catch (e) { if (!(e instanceof ConflictError)) throw e; }
        }
        return { status: 200, body: { ok: true, job: null } };
      }
      case 'get': {
        const t = String(b.table ?? ''); const id = String(b.id ?? '');
        if (!READ_TABLES.has(t)) return err(403, 'table_not_readable');
        if (!ID_RE.test(id)) return err(400, 'bad_id');
        return { status: 200, body: { ok: true, doc: await db.get(t, id) } };
      }
      case 'query': {
        const t = String(b.table ?? '');
        if (!READ_TABLES.has(t)) return err(403, 'table_not_readable');
        const where = Array.isArray(b.where) ? b.where : [];
        if (where.length > 8) return err(400, 'too_many_filters');
        for (const w of where) {
          if (!Array.isArray(w) || w.length !== 3 || !(w[0] === 'id' || FIELD_RE.test(String(w[0]))) || !OPS.has(w[1] as Op)) return err(400, 'bad_filter');
          if (w[1] === 'in' && !(Array.isArray(w[2]) && w[2].length <= 100)) return err(400, 'bad_filter');
        }
        const ob = b.orderBy == null ? null : typeof b.orderBy === 'string' ? { field: b.orderBy, dir: 'asc' as const } : isObj(b.orderBy) ? { field: String(b.orderBy.field), dir: b.orderBy.dir === 'desc' ? 'desc' as const : 'asc' as const } : undefined;
        if (ob === undefined || (ob && !(ob.field === 'id' || FIELD_RE.test(ob.field)))) return err(400, 'bad_order');
        const limit = b.limit == null ? 50 : Number(b.limit);
        if (!Number.isInteger(limit) || limit < 1 || limit > 100) return err(400, 'bad_limit');
        return { status: 200, body: { ok: true, docs: await db.query(t, where as [string, Op, unknown][], ob, limit) } };
      }
      case 'write': {
        const t = String(b.table ?? ''); const id = String(b.id ?? '');
        if (!READ_TABLES.has(t)) return err(403, 'table_not_writable');
        if (!ID_RE.test(id)) return err(400, 'bad_id');
        if (!isObj(b.data)) return err(400, 'bad_data');
        const merge = b.merge === true;
        const ifv = b.ifVersion == null ? null : Number(b.ifVersion);
        if (ifv != null && !Number.isInteger(ifv)) return err(400, 'bad_version');
        const cur = await db.get(t, id);
        if (t === 'jobs' && !cur) {
          // Creating a job: only an auto-art job, as a plain insert, stamped with the server time.
          if (merge || ifv != null) return err(403, 'job_not_found');
          const whyArt = await artJobRule(db, b.data);
          if (whyArt) return err(403, whyArt);
          const w = await db.write(t, id, { ...b.data, createdAt: new Date(now).toISOString() }, null, false);
          return { status: 200, body: { ok: true, id: w.id, version: w.version } };
        }
        const why = writeRule(t, id, b.data, cur, merge, b.runId);
        if (why) return err(403, why);
        if (cur && ifv != null && ifv !== cur.version) return err(409, 'version_conflict');
        if (!cur && ifv != null) return err(404, 'not_found');
        // Existing doc without ifVersion: a merge is applied at the current version; a full replace needs ifVersion.
        if (cur && ifv == null && !merge) return err(409, 'exists');
        const w = await db.write(t, id, b.data, cur ? (ifv ?? cur.version) : null, !!cur && merge);
        return { status: 200, body: { ok: true, id: w.id, version: w.version } };
      }
      case 'file-url': {
        if (!safePath(b.path, READ_PATH_RE)) return err(400, 'bad_path');
        return { status: 200, body: { ok: true, url: await db.signedDownload(b.path, 600), expiresIn: 600 } };
      }
      case 'upload-url': {
        if (!safePath(b.path, UPLOAD_PATH_RE)) return err(400, 'bad_path');
        const u = await db.signedUpload(b.path);
        return { status: 200, body: { ok: true, ...u, path: b.path } };
      }
      default:
        return err(404, 'unknown_action');
    }
  } catch (e) {
    if (e instanceof ConflictError) return err(409, 'version_conflict');
    return err(500, 'server_error');
  }
}
