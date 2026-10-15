// Production bundle -> dist/ (index.html + assets/app.js + assets/app.css).
// Config comes from the environment at build time. The anon key is public by design; RLS protects the data.
import path from 'node:path';
import { bundle, root } from './_build.mjs';
import { isPublicAnonKey } from './anon-key.mjs';

const url = process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_ANON_KEY || '';
const wanted = process.env.STUDIO_MODE || (url && key ? 'supabase' : 'demo');
const mode = ['supabase', 'demo', 'mock'].includes(wanted) ? wanted : 'demo';
if (mode === 'supabase' && !(url && key)) {
  console.error('STUDIO_MODE=supabase needs SUPABASE_URL and SUPABASE_ANON_KEY.');
  process.exit(1);
}
if (key && !isPublicAnonKey(key)) {
  // Never print the key itself.
  console.error('SUPABASE_ANON_KEY must be a publishable key (sb_publishable_…) or an anon JWT. Refusing to put any other key in the browser bundle.');
  process.exit(1);
}
const r = await bundle({ outdir: path.join(root, 'dist'), mode, mock: false, minify: true, config: { supabaseUrl: url, supabaseAnonKey: key } });
const kb = Object.values(r.metafile.outputs).map((o) => o.bytes).reduce((a, b) => a + b, 0) / 1024;
console.log(`built dist/ in ${mode} mode (${kb.toFixed(0)} KB total)`);
for (const [f, o] of Object.entries(r.metafile.outputs)) console.log(`  ${path.relative(path.join(root, 'dist'), f).padEnd(44)} ${(o.bytes / 1024).toFixed(1).padStart(7)} KB`);
