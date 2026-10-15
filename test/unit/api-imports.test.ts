import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Vercel runs api/*.ts as native ES modules ("type": "module"), so every relative
// import needs an explicit .js extension or the function crashes with ERR_MODULE_NOT_FOUND.
function tsFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? tsFiles(p) : p.endsWith('.ts') ? [p] : [];
  });
}

test('every relative import in api/ ends in .js', () => {
  const bad: string[] = [];
  for (const f of tsFiles(path.join(process.cwd(), 'api'))) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g)) {
      if (!m[1].endsWith('.js')) bad.push(`${path.relative(process.cwd(), f)}: ${m[1]}`);
    }
  }
  assert.deepEqual(bad, []);
});
