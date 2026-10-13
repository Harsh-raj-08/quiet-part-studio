// Mock-mode bundle for tests -> test/dist/. @supabase/supabase-js is not installed in the local workspace,
// so it is aliased to test/stubs/supabase.ts. The app runs against the in-memory adapter and exposes window.__mock.
import path from 'node:path';
import { bundle, root } from './_build.mjs';

await bundle({
  outdir: path.join(root, 'test/dist'),
  mode: 'mock',
  mock: true,
  minify: false,
  alias: { '@supabase/supabase-js': path.join(root, 'test/stubs/supabase.ts') },
});
console.log('built test/dist (mock mode)');
