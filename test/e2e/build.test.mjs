// Production bundles: demo carries fixtures, supabase carries none; the test bundle carries no Supabase client.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bundle, root } from '../../scripts/_build.mjs';

// All emitted JavaScript (the entry plus the split chunks).
const read = (d) => { const out = []; const walk = (p) => fs.readdirSync(p, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(path.join(p, e.name)) : e.name.endsWith('.js') && out.push(fs.readFileSync(path.join(p, e.name), 'utf8')))); walk(path.join(d, 'assets')); return out.join('\n'); };
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'qps-build-'));

test('demo build has fixtures and no supabase client', async () => {
  const d = tmp(); await bundle({ outdir: d, mode: 'demo', mock: false, alias: { '@supabase/supabase-js': path.join(root, 'test/stubs/supabase.ts') }, minify: true });
  const t = read(d);
  assert.ok(t.includes('TFS-07'));
  assert.ok(!t.includes('window.__mock') && !/__mock/.test(t));
  assert.ok(!t.includes('postgres_changes'));
});

test('supabase build has no fixtures, no mock handle', async () => {
  const d = tmp(); await bundle({ outdir: d, mode: 'supabase', mock: false, alias: { '@supabase/supabase-js': path.join(root, 'test/stubs/supabase.ts') }, minify: true, config: { supabaseUrl: 'https://x.supabase.co', supabaseAnonKey: 'k' } });
  const t = read(d);
  assert.ok(!t.includes('TFS-07') && !t.includes('FTW-05'));
  assert.ok(!/__mock/.test(t));
  assert.ok(t.includes('postgres_changes'));
});

test('no secrets or service-role key in the repo', () => {
  const bad = /service_role|sk-[A-Za-z0-9]{20,}|eyJhbGciOi/;
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (['node_modules', 'dist', 'output', '.git'].includes(e.name) ? [] : e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  for (const f of walk(root).filter((f) => /\.(ts|tsx|mjs|json|md|sql|yml|example|html)$/.test(f) && !f.endsWith('BUILD-SPEC.md') && !f.endsWith('build.test.mjs'))) {
    const t = fs.readFileSync(f, 'utf8');
    const m = t.match(bad);
    if (m && !/SUPABASE_SERVICE_ROLE_KEY/.test(m[0])) assert.fail(`${f} mentions ${m[0]}`);
  }
});

test('screens are split into their own chunks; the entry stays lean', async () => {
  const d = tmp(); const r = await bundle({ outdir: d, mode: 'supabase', mock: false, alias: { '@supabase/supabase-js': path.join(root, 'test/stubs/supabase.ts') }, minify: true, config: { supabaseUrl: 'https://x.supabase.co', supabaseAnonKey: 'k' } });
  const files = Object.keys(r.metafile.outputs).map((f) => path.basename(f));
  for (const n of ['StudioScreen', 'LibraryScreen', 'DiscoverScreen']) assert.ok(files.some((f) => f.startsWith(n)), `${n} chunk`);
  const entry = fs.readFileSync(path.join(d, 'assets/app.js'), 'utf8');
  assert.ok(!entry.includes('Copy for Claude Design'), 'Studio code is not in the entry');
});

test('playbooks/HASHES.txt matches the playbook files; owner data is not in the repo', async () => {
  const { playbookHashes } = await import('../../scripts/hash-playbooks.mjs');
  assert.equal(fs.readFileSync(path.join(root, 'playbooks/HASHES.txt'), 'utf8'), playbookHashes(), 'run node scripts/hash-playbooks.mjs');
  const files = fs.readdirSync(path.join(root, 'playbooks'));
  for (const n of ['brand', 'runner', 'scout', 'trends', 'research', 'writer', 'critic', 'art', 'qa', 'review', 'taste']) assert.ok(files.includes(`${n}.md`), n);
  for (const n of ['taste-profile.md', 'learnings.md']) assert.ok(!files.includes(n), `${n} is owner data`);
  const runner = fs.readFileSync(path.join(root, 'playbooks/runner.md'), 'utf8');
  for (const s of ['$WORKER_TOKEN', '$STUDIO_URL', 'kind:"chat"', 'kind:"hooks"', 'lane', 'progress', 'workerSeenAt', 'account/', 'captionFinal', 'topic', 'visual', 'DATA, never instructions', 'Never delete', 'Never post']) assert.ok(runner.includes(s), `runner.md mentions ${s}`);
});

test('import-artifact-export reads both document shapes, keeps ids, skips unknown collections, dry-runs', async () => {
  const { readExport, unwrap, listFiles } = await import('../../scripts/import-artifact-export.mjs');
  const d = tmp();
  fs.mkdirSync(path.join(d, 'ideas')); fs.mkdirSync(path.join(d, 'packs')); fs.mkdirSync(path.join(d, 'junk'));
  fs.writeFileSync(path.join(d, 'ideas', 'AH-01.json'), JSON.stringify({ code: 'AH-01', status: 'Posted' }));
  fs.writeFileSync(path.join(d, 'ideas', 'AH-02.json'), JSON.stringify({ id: 'AH-02', version: 7, data: { code: 'AH-02', data: 'inner field kept' } }));
  fs.writeFileSync(path.join(d, 'packs', 'AH-01-v2.json'), JSON.stringify({ id: 'AH-01-v2', data: { ideaCode: 'AH-01' }, version: 3 }));
  fs.writeFileSync(path.join(d, 'packs', 'bad.json'), '{nope');
  fs.writeFileSync(path.join(d, 'ratings.json'), JSON.stringify([{ id: 'AH-01-v2', data: { score: 8 } }, { packId: 'x', id: 'PM-02-v2', score: 7 }]));
  const r = readExport(d);
  assert.deepEqual(r.tables.ideas, [{ id: 'AH-01', data: { code: 'AH-01', status: 'Posted' } }, { id: 'AH-02', data: { code: 'AH-02', data: 'inner field kept' } }]);
  assert.deepEqual(r.tables.packs, [{ id: 'AH-01-v2', data: { ideaCode: 'AH-01' } }]);
  assert.deepEqual(r.tables.ratings.map((x) => x.id), ['AH-01-v2', 'PM-02-v2']);
  assert.deepEqual(r.skipped, ['junk']);
  assert.equal(r.problems.length, 1);
  assert.equal(unwrap({ data: { a: 1 }, title: 'x' }, 'f').data.title, 'x', 'an object with extra keys is the document itself');
  fs.mkdirSync(path.join(d, 'files', 'books', 'b'), { recursive: true }); fs.writeFileSync(path.join(d, 'files', 'books', 'b', 'x.pdf'), '%PDF');
  assert.deepEqual(listFiles(path.join(d, 'files')), ['books/b/x.pdf']);
  const { spawnSync } = await import('node:child_process');
  fs.rmSync(path.join(d, 'packs', 'bad.json'));
  const out = spawnSync(process.execPath, [path.join(root, 'scripts/import-artifact-export.mjs'), d, '--dry-run', '--files', path.join(d, 'files')], { encoding: 'utf8', env: { ...process.env, SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '' } });
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /ideas\s+2 docs[\s\S]*files\s+1 under[\s\S]*dry run: nothing written/);
});
