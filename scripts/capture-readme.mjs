// README screenshots from the DEMO build (invented fixtures only; no Supabase, no network).
// Serves the bundle under /quiet-part-studio/ (like GitHub Pages) and writes docs/img/*.png, plus docs/img/nav.gif when ffmpeg is on PATH.
// Usage: node scripts/capture-readme.mjs   (playwright + chromium; NODE_PATH works too)
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { bundle, root } from './_build.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const OUT = path.join(root, 'docs/img');
const PREFIX = '/quiet-part-studio';
const NOW = '2026-10-11T06:30:00Z'; // the fixtures' "today" (12:00 in Asia/Kolkata)
const W = 1440, H = 900;

const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'qps-readme-'));
await bundle({ outdir: dist, mode: 'demo', mock: false, minify: true });
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent((req.url || '/').split('?')[0]);
  if (!u.startsWith(`${PREFIX}/`)) { res.writeHead(404); res.end(); return; }
  let f = path.join(dist, u.slice(PREFIX.length));
  if (!f.startsWith(dist) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dist, 'index.html');
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  res.end(fs.readFileSync(f));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}${PREFIX}/`;
fs.mkdirSync(OUT, { recursive: true });

// Optional: quantize the PNGs with sharp when it is installed (not a dependency); otherwise keep them as captured.
let sharp = null;
try { sharp = require('sharp'); } catch { sharp = null; }
async function shrink(file) {
  if (!sharp) return;
  const buf = await sharp(file).png({ palette: true, colours: 128, effort: 10, dither: 0.5 }).toBuffer();
  if (buf.length < fs.statSync(file).size) fs.writeFileSync(file, buf);
}

const browser = await chromium.launch();
const requests = [];
async function open({ hash = '', theme = 'night', sideHidden = false, video = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, timezoneId: 'Asia/Kolkata', locale: 'en-GB', ...(video ? { recordVideo: { dir: video, size: { width: W, height: H } } } : {}) });
  const page = await ctx.newPage();
  // The demo must not call Supabase or /api. Google Fonts are allowed when reachable (fallback fonts otherwise).
  page.on('request', (r) => { const u = r.url(); if (!u.startsWith(base) && !/fonts\.(googleapis|gstatic)\.com/.test(u)) requests.push(u); });
  await page.clock.setFixedTime(new Date(NOW));
  await page.addInitScript(([t, s]) => { try { localStorage.setItem('qps.theme', t); if (s) localStorage.setItem('qps.sideHidden', '1'); } catch {} }, [theme, sideHidden]);
  await page.goto(base + hash);
  await page.waitForSelector('[data-board], [data-list], [data-screen]');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);
  return { page, ctx };
}
async function shot(name, opts, prep) {
  const { page, ctx } = await open(opts);
  if (prep) await prep(page);
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file });
  await shrink(file);
  await ctx.close();
  console.log(`docs/img/${name}.png`);
}

await shot('ideas-night', {});
await shot('ideas-paper', { theme: 'paper' });
await shot('studio-script', { hash: '#studio/script/FTW-05-v3' });
await shot('studio-frames', { hash: '#studio/frames/SH-01-v4' });
await shot('library', { hash: '#library/shelf' });
await shot('insights', { hash: '#insights' });
await shot('insights-taste', { hash: '#insights/taste' });
await shot('system', { hash: '#system' });
await shot('nav-sidebar', {});
await shot('nav-command-bar', { sideHidden: true });

// The sidebar <-> command bar transition, recorded and turned into a GIF if ffmpeg is available.
const ff = spawnSync('ffmpeg', ['-version']);
if (ff.status === 0) {
  const vdir = fs.mkdtempSync(path.join(os.tmpdir(), 'qps-nav-'));
  const { page, ctx } = await open({ video: vdir });
  await page.mouse.move(W / 2, H / 2);
  await page.waitForTimeout(600);
  await page.keyboard.press('Control+\\'); await page.waitForTimeout(1500); await page.keyboard.press('Control+\\'); await page.waitForTimeout(1500);
  const v = page.video();
  await ctx.close();
  const webm = await v.path();
  const gif = path.join(OUT, 'nav.gif');
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '1.6', '-t', '3.2', '-i', webm, '-vf', 'fps=12,scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=48:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle', gif]);
  if (r.status === 0) console.log(`docs/img/nav.gif (${(fs.statSync(gif).size / 1024).toFixed(0)} KB)`); else console.log('ffmpeg failed; skipped nav.gif', String(r.stderr));
} else console.log('ffmpeg not found; skipped nav.gif');

await browser.close();
server.close();
fs.rmSync(dist, { recursive: true, force: true });
if (requests.length) { console.error('The demo made requests outside the page:', [...new Set(requests)]); process.exit(1); }
