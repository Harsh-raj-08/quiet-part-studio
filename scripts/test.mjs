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
// Two reporters: the usual spec output, and a JSON-lines file of failures for GitHub annotations.
const failLog = path.join(root, 'test/output/failures.jsonl');
fs.mkdirSync(path.dirname(failLog), { recursive: true });
fs.rmSync(failLog, { force: true });
const r = spawnSync(process.execPath, ['--test', '--test-concurrency=3', '--test-timeout=240000',
  '--test-reporter=spec', '--test-reporter-destination=stdout',
  `--test-reporter=${path.join(root, 'scripts/gh-reporter.mjs')}`, `--test-reporter-destination=${failLog}`, ...files],
  // Same clock zone and locale everywhere (the owner's; CI runners are UTC). Browser contexts pin their own zone (UTC) in test/helpers.mjs.
  { stdio: 'inherit', cwd: root, env: { ...process.env, TZ: process.env.TZ_TEST || 'Asia/Kolkata', LANG: 'en_GB.UTF-8', LC_ALL: 'en_GB.UTF-8' } });

const lines = fs.existsSync(failLog) ? fs.readFileSync(failLog, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : [];
const fails = lines.filter((x) => !x.pass);
if (process.env.GITHUB_ACTIONS) {
  const esc = (s) => String(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  const escProp = (s) => esc(s).replace(/:/g, '%3A').replace(/,/g, '%2C');
  for (const f of fails) {
    const file = path.relative(root, f.file || '').replace(/^test\/dist-unit\/(.*)\.mjs$/, 'test/unit/$1.ts') || 'scripts/test.mjs';
    console.log(`::error file=${escProp(file)},title=${escProp(f.name)}::${esc(f.message.slice(0, 300))}`);
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    const slow = lines.filter((x) => x.pass).sort((a, b) => b.ms - a.ms).slice(0, 5);
    const md = [`## Tests: ${fails.length ? `${fails.length} failed` : 'all passed'}`, '',
      ...(fails.length ? ['| File | Test | Message |', '|---|---|---|', ...fails.map((f) => `| ${path.basename(f.file || '')} | ${f.name.replace(/\|/g, '\\|')} | ${f.message.slice(0, 200).replace(/\n/g, ' ').replace(/\|/g, '\\|')} |`)] : []),
      '', 'Slowest:', ...slow.map((x) => `- ${x.name} (${(x.ms / 1000).toFixed(1)} s)`), ''].join('\n');
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
  }
}
process.exit(r.status ?? 1);
