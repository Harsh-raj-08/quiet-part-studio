// Import an ArtifactData export of the old studio into Supabase (service role). Run by the owner, never in CI.
//
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/import-artifact-export.mjs <exportDir> [--dry-run] [--files <dir>]
//
// <exportDir>/<collection>/<id>.json, where each file is either the document data itself or a wrapper
// {id, version, data}. (<exportDir>/<collection>.json holding an array of either shape also works.)
// Rows are upserted by id into the table of the same name, with version reset to 1. Unknown collections are skipped.
// --files <dir> uploads every file under <dir> to the private "studio" bucket at the same relative path (upsert).
// --dry-run reads and validates everything and prints counts; nothing is written or uploaded.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const TABLES = ['books', 'booknotes', 'ideas', 'packs', 'posts', 'jobs', 'runs', 'reports', 'qa', 'metrics', 'chats', 'ratings', 'playbooks', 'settings', 'account'];
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);

/** A wrapper is {data:{…}} plus only id/version/path-ish keys; anything else is the document itself. */
export function unwrap(raw, fallbackId) {
  if (isObj(raw) && isObj(raw.data) && Object.keys(raw).every((k) => ['id', 'version', 'data', 'path', 'collection', 'updatedAt', 'createdAt'].includes(k))) {
    return { id: String(raw.id ?? fallbackId), data: raw.data };
  }
  if (isObj(raw)) return { id: String(fallbackId ?? raw.id), data: raw };
  return null;
}

/** Read an export directory into {table: [{id, data}]}, plus problems found. */
export function readExport(dir) {
  const out = {}; const problems = []; const skipped = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const name = ent.isDirectory() ? ent.name : ent.name.replace(/\.json$/, '');
    if (!ent.isDirectory() && !ent.name.endsWith('.json')) continue;
    if (!TABLES.includes(name)) { skipped.push(ent.name); continue; }
    const rows = (out[name] ??= []);
    const add = (raw, fid, where) => {
      const d = unwrap(raw, fid);
      if (!d) { problems.push(`${where}: not a JSON object`); return; }
      if (!ID_RE.test(d.id)) { problems.push(`${where}: bad id ${JSON.stringify(d.id)}`); return; }
      rows.push(d);
    };
    if (ent.isDirectory()) {
      for (const f of fs.readdirSync(path.join(dir, name)).filter((x) => x.endsWith('.json')).sort()) {
        const p = path.join(dir, name, f);
        try { add(JSON.parse(fs.readFileSync(p, 'utf8')), decodeURIComponent(f.replace(/\.json$/, '')), `${name}/${f}`); } catch (e) { problems.push(`${name}/${f}: ${e.message}`); }
      }
    } else {
      try {
        const arr = JSON.parse(fs.readFileSync(path.join(dir, ent.name), 'utf8'));
        (Array.isArray(arr) ? arr : []).forEach((x, i) => add(x, isObj(x) ? x.id : undefined, `${ent.name}[${i}]`));
      } catch (e) { problems.push(`${ent.name}: ${e.message}`); }
    }
    const seen = new Set();
    for (const r of rows) { if (seen.has(r.id)) problems.push(`${name}: duplicate id ${r.id}`); seen.add(r.id); }
  }
  return { tables: out, problems, skipped };
}

export function listFiles(root) {
  const out = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.isFile()) out.push(path.relative(root, p).split(path.sep).join('/')); } };
  walk(root);
  return out.sort();
}

const TYPES = { pdf: 'application/pdf', epub: 'application/epub+zip', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', json: 'application/json' };

async function main(argv) {
  const dry = argv.includes('--dry-run');
  const fi = argv.indexOf('--files');
  const filesDir = fi >= 0 ? argv[fi + 1] : null;
  const dir = argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--files');
  if (!dir || !fs.existsSync(dir)) { console.error('usage: node scripts/import-artifact-export.mjs <exportDir> [--dry-run] [--files <dir>]'); process.exit(2); }
  const { tables, problems, skipped } = readExport(dir);
  for (const [t, rows] of Object.entries(tables)) console.log(`${t.padEnd(10)} ${String(rows.length).padStart(5)} docs`);
  if (skipped.length) console.log(`skipped (not a studio collection): ${skipped.join(', ')}`);
  if (problems.length) { console.log(`${problems.length} problem(s):`); problems.slice(0, 50).forEach((p) => console.log(`  ${p}`)); }
  const files = filesDir ? listFiles(filesDir) : [];
  if (filesDir) console.log(`files      ${String(files.length).padStart(5)} under ${filesDir}`);
  if (dry) { console.log('dry run: nothing written'); return; }
  if (problems.length) { console.error('fix the problems above first (or remove those files)'); process.exit(1); }
  const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required'); process.exit(2); }
  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const now = new Date().toISOString();
  for (const [t, rows] of Object.entries(tables)) {
    for (let i = 0; i < rows.length; i += 200) {
      const batch = rows.slice(i, i + 200).map((r) => ({ id: r.id, data: r.data, version: 1, updated_at: now }));
      const { error } = await sb.from(t).upsert(batch, { onConflict: 'id' });
      if (error) { console.error(`${t}: ${error.message}`); process.exit(1); }
    }
    console.log(`${t}: upserted ${rows.length}`);
  }
  for (const f of files) {
    const ext = (f.split('.').pop() || '').toLowerCase();
    const { error } = await sb.storage.from('studio').upload(f, fs.readFileSync(path.join(filesDir, f)), { upsert: true, contentType: TYPES[ext] ?? 'application/octet-stream' });
    if (error) { console.error(`file ${f}: ${error.message}`); process.exit(1); }
  }
  if (files.length) console.log(`uploaded ${files.length} file(s) to studio/`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await main(process.argv.slice(2));
