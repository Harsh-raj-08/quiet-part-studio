// Production bundles: demo carries fixtures, supabase carries none; the test bundle carries no Supabase client.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bundle, root } from '../../scripts/_build.mjs';

const read = (d) => fs.readFileSync(path.join(d, 'assets/app.js'), 'utf8');
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
