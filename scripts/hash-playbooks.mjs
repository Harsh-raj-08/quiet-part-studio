// Writes playbooks/HASHES.txt: "<sha256, first 16 hex>  <file>" for every playbooks/*.md, sorted by name.
// The worker can check the files it was given against it; a test fails when a playbook changes without re-hashing.
// Usage: node scripts/hash-playbooks.mjs [--check]
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'playbooks');
export function playbookHashes() {
  return fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort()
    .map((f) => `${crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, f))).digest('hex').slice(0, 16)}  ${f}`).join('\n') + '\n';
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const want = playbookHashes();
  const file = path.join(dir, 'HASHES.txt');
  if (process.argv.includes('--check')) {
    const have = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    if (have !== want) { console.error('playbooks/HASHES.txt is out of date: run node scripts/hash-playbooks.mjs'); process.exit(1); }
    console.log('playbooks/HASHES.txt matches');
  } else { fs.writeFileSync(file, want); console.log(want.trim()); }
}
