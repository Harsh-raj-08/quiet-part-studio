// Build the mock-mode bundle, bundle the unit tests, run everything with node:test.
// Usage: node scripts/test.mjs [--unit] [--e2e]   (NODE_PATH must point at the dependencies locally)
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { esbuild, root } from './_build.mjs';

const unit = process.argv.includes('--unit');
const e2e = process.argv.includes('--e2e');
const both = !unit && !e2e;

const files = [];
if (unit || both) {
  const outdir = path.join(root, 'test/dist-unit');
  fs.rmSync(outdir, { recursive: true, force: true });
  const entries = fs.readdirSync(path.join(root, 'test/unit')).filter((f) => f.endsWith('.test.ts')).map((f) => path.join(root, 'test/unit', f));
  await esbuild.build({
    entryPoints: entries, outdir, bundle: true, format: 'esm', platform: 'node', target: 'node22', jsx: 'automatic', outExtension: { '.js': '.mjs' },
    external: ['node:*'], logLevel: 'warning', nodePaths: (process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean),
    alias: { '@supabase/supabase-js': path.join(root, 'test/stubs/supabase.ts') },
    banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  });
  files.push(...fs.readdirSync(outdir).filter((f) => f.endsWith('.mjs')).map((f) => path.join(outdir, f)));
}
if (e2e || both) {
  const b = spawnSync(process.execPath, [path.join(root, 'scripts/build-test.mjs')], { stdio: 'inherit' });
  if (b.status) process.exit(b.status);
  files.push(...fs.readdirSync(path.join(root, 'test/e2e')).filter((f) => f.endsWith('.test.mjs')).sort().map((f) => path.join(root, 'test/e2e', f)));
}
const r = spawnSync(process.execPath, ['--test', '--test-concurrency=3', '--test-timeout=120000', ...files], { stdio: 'inherit', cwd: root });
process.exit(r.status ?? 1);
