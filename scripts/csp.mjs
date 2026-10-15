// Content-Security-Policy for vercel.json. The only inline script is the theme bootstrap in index.html; it is allowed by its hash.
//   node scripts/csp.mjs          write the policy (with the current hash) into vercel.json
//   node scripts/csp.mjs --check  exit 1 when vercel.json is out of date
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** sha256 (base64) of each inline <script> in index.html, in CSP source form. */
export function inlineScriptHashes(html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')) {
  return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => `'sha256-${crypto.createHash('sha256').update(m[1], 'utf8').digest('base64')}'`);
}

export function csp(hashes = inlineScriptHashes()) {
  return [
    "default-src 'self'",
    `script-src 'self' ${hashes.join(' ')}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    'font-src https://fonts.gstatic.com',
    "img-src 'self' blob: data: https://*.supabase.co",
    "media-src 'self' blob: https://*.supabase.co",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "object-src 'none'",
    "form-action 'self'",
  ].join('; ');
}

export function securityHeaders() {
  return [
    { key: 'Content-Security-Policy', value: csp() },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  ];
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const file = path.join(root, 'vercel.json');
  const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
  const want = [{ source: '/(.*)', headers: securityHeaders() }];
  if (process.argv.includes('--check')) {
    const ok = JSON.stringify(cfg.headers) === JSON.stringify(want);
    console.log(ok ? 'vercel.json headers are up to date' : 'vercel.json headers are stale: run node scripts/csp.mjs');
    process.exit(ok ? 0 : 1);
  }
  cfg.headers = want;
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + '\n');
  console.log(`wrote vercel.json (${inlineScriptHashes().join(' ')})`);
}
