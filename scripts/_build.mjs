// Shared esbuild setup for the production bundle and the mock-mode test bundle.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
export const esbuild = require('esbuild');
export const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

export async function bundle({ outdir, mode, mock, alias = {}, minify, config = {} }) {
  fs.rmSync(outdir, { recursive: true, force: true });
  fs.mkdirSync(path.join(outdir, 'assets'), { recursive: true });
  const cfg = { mode, supabaseUrl: '', supabaseAnonKey: '', ...config };
  const result = await esbuild.build({
    entryPoints: { app: path.join(root, 'src/main.tsx') },
    outdir: path.join(outdir, 'assets'),
    entryNames: '[name]',
    bundle: true,
    format: 'iife',
    target: 'es2022',
    jsx: 'automatic',
    platform: 'browser',
    minify,
    sourcemap: minify ? false : 'inline',
    legalComments: 'none',
    alias,
    // The local workspace has no npm registry: dependencies come from NODE_PATH (/opt/npm-tools/node_modules). In CI they are in ./node_modules.
    nodePaths: (process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean),
    loader: { '.json': 'json' },
    define: {
      'process.env.NODE_ENV': JSON.stringify(minify ? 'production' : 'development'),
      __QPS_MODE__: JSON.stringify(mode),
      __QPS_CONFIG__: JSON.stringify(cfg),
      __MOCK__: String(!!mock),
    },
    logLevel: 'warning',
    metafile: true,
  });
  fs.copyFileSync(path.join(root, 'index.html'), path.join(outdir, 'index.html'));
  return result;
}
