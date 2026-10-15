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
    // A migration may grant to the service_role database role by name; that is not a key.
    const t = fs.readFileSync(f, 'utf8').replace(/^grant execute on function [^;]+ to service_role;$/gm, '');
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

test('vercel.json: security headers with the CSP hash of the inline theme script; installs without scripts', async () => {
  const { inlineScriptHashes, securityHeaders } = await import('../../scripts/csp.mjs');
  const cfg = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  assert.equal(cfg.installCommand, 'npm install --ignore-scripts');
  const hs = inlineScriptHashes();
  assert.equal(hs.length, 1, 'one inline script (theme bootstrap)');
  const h = Object.fromEntries(cfg.headers.find((x) => x.source === '/(.*)').headers.map((x) => [x.key, x.value]));
  assert.ok(h['Content-Security-Policy'].includes(`script-src 'self' ${hs[0]}`), 'run node scripts/csp.mjs after editing the inline script');
  assert.match(h['Content-Security-Policy'], /frame-ancestors 'none'.*base-uri 'none'.*object-src 'none'/);
  assert.deepEqual(cfg.headers[0].headers, securityHeaders());
  assert.equal(h['X-Content-Type-Options'], 'nosniff');
  // Assets are relative so the demo also works under /quiet-part-studio/ on GitHub Pages.
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.ok(!/(src|href)="\/(?!\/)/.test(html), 'no root-absolute asset paths in index.html');
});

test('only a publishable or anon key may go into the browser bundle', async () => {
  const { isPublicAnonKey } = await import('../../scripts/anon-key.mjs');
  const jwt = (p) => ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify(p)).toString('base64url'), 'sig'].join('.');
  assert.equal(isPublicAnonKey('sb_publishable_abcDEF123_x'), true);
  assert.equal(isPublicAnonKey(jwt({ role: 'anon', iss: 'supabase' })), true);
  assert.equal(isPublicAnonKey(jwt({ role: 'service_role' })), false);
  assert.equal(isPublicAnonKey('sb_secret_abc'), false);
  assert.equal(isPublicAnonKey('not-a-key'), false);
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync(process.execPath, [path.join(root, 'scripts/build.mjs')], { encoding: 'utf8', env: { ...process.env, STUDIO_MODE: 'supabase', SUPABASE_URL: 'https://x.invalid', SUPABASE_ANON_KEY: jwt({ role: 'service_role' }) } });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Refusing/);
  assert.ok(!r.stderr.includes('service_role'), 'the key is never printed');
});

test('pages workflow: write permissions only on the deploy job; hardening migration is idempotent SQL', () => {
  const y = fs.readFileSync(path.join(root, '.github/workflows/pages.yml'), 'utf8');
  const [top, jobs] = y.split(/^jobs:/m);
  assert.match(top, /permissions:\s*\n\s*contents: read\s*\n/);
  assert.ok(!/pages: write|id-token: write/.test(top));
  const [build, deploy] = jobs.split(/^  deploy:/m);
  assert.ok(!/pages: write|id-token: write/.test(build));
  assert.match(deploy, /pages: write[\s\S]*id-token: write/);
  const sql = fs.readFileSync(path.join(root, 'supabase/migrations/0003_hardening.sql'), 'utf8');
  assert.match(sql, /revoke execute on function public\.write_doc\(text, text, jsonb, int, boolean\) from anon/);
  assert.match(sql, /revoke all on all tables in schema public from anon/);
  assert.ok(!/\b(drop|delete|truncate)\b/i.test(sql.replace(/--.*$/gm, '')));
});
