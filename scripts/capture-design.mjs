// Renders the owner's Claude Design file and saves baseline screenshots into test/parity/.
// Local only: needs /home/claude/redesign (not part of the repo). CI uses the committed baselines.
// Usage: NODE_PATH=/opt/npm-tools/node_modules node scripts/capture-design.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const SRC = process.env.DESIGN_SRC || '/home/claude/redesign/src';
const SHIM = process.env.DESIGN_SHIM || '/home/claude/redesign/shim/react-umd.js';
const OUT = path.resolve('test/parity');
fs.mkdirSync(OUT, { recursive: true });

const server = http.createServer((req, res) => {
  const f = path.join(SRC, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(SRC) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  const t = f.endsWith('.js') ? 'text/javascript' : f.endsWith('.html') ? 'text/html' : 'application/octet-stream';
  res.writeHead(200, { 'content-type': t }); res.end(fs.readFileSync(f));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
async function page() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' });
  const pg = await ctx.newPage();
  await pg.route('**/*', (r) => (r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort()));
  await pg.addInitScript(fs.readFileSync(SHIM, 'utf8'));
  await pg.goto(`${base}/${encodeURIComponent('Quiet Part Studio.dc.html')}`);
  await pg.waitForTimeout(2500);
  // Freeze looping animations (status pulse, writer line) so the baseline is deterministic. The app side does the same.
  await pg.addStyleTag({ content: '*,*::before,*::after{animation:none!important}' });
  await pg.waitForTimeout(100);
  return pg;
}
export const STEPS_3B = [
  ['studio-grid', ['04 · Studio']],
  ['studio-script', ['04 · Studio', 'FTW-05']],
  ['studio-frames', ['04 · Studio', 'FTW-05', 'Frames']],
  ['studio-qa', ['04 · Studio', 'TFS-01', 'Media & QA']],
  ['studio-posts', ['04 · Studio', 'FTW-05', 'Posts & stories']],
  ['library-shelf', ['02 · Library']],
  ['library-notes', ['02 · Library', 'Chapter notes']],
  ['library-bank', ['02 · Library', 'Idea bank']],
  // Phase 3c
  ['discover-ask', ['01 · Discover']],
  ['discover-reports', ['01 · Discover', 'Scout reports']],
  ['discover-trends', ['01 · Discover', 'Trends']],
  ['insights-log', ['05 · Insights']],
  ['insights-review', ['05 · Insights', 'Weekly review']],
  ['insights-works', ['05 · Insights', 'What works']],
  ['system-runs', ['System']],
  ['system-jobs', ['System', 'Jobs']],
  ['system-settings', ['System', 'Settings']],
];
// --only=<prefix> re-captures just the matching screens (e.g. --only=discover).
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) ?? '').slice(7);
const shot = (pg, name) => pg.screenshot({ path: path.join(OUT, `design-${name}.png`) });

for (const theme of ONLY ? [] : ['night', 'paper']) {
  const pg = await page();
  if (theme === 'paper') { await pg.getByText('Paper', { exact: true }).first().click(); await pg.waitForTimeout(600); }
  await shot(pg, `${theme}-sidebar`);
  await pg.keyboard.press('Control+\\'); await pg.waitForTimeout(900);
  await shot(pg, `${theme}-command`);
  await pg.keyboard.press('Control+\\'); await pg.waitForTimeout(900);
  await pg.locator('text=TFS-07').first().click(); await pg.waitForTimeout(700);
  await shot(pg, `${theme}-drawer`);
  await pg.keyboard.press('Control+\\'); await pg.waitForTimeout(900);
  await shot(pg, `${theme}-drawer-command`);
  await pg.context().close();
}

// Phase 3b: Studio and Library, in the owner's Command bar layout.
const click = async (pg, text) => { await pg.getByText(text, { exact: true }).first().click(); await pg.waitForTimeout(500); };
for (const theme of ['night', 'paper']) {
  for (const [name, steps] of STEPS_3B.filter(([n]) => !ONLY || ONLY.split(',').some((o) => n.startsWith(o)))) {
    const pg = await page();
    if (theme === 'paper') { await pg.getByText('Paper', { exact: true }).first().click(); await pg.waitForTimeout(600); }
    await pg.keyboard.press('Control+\\'); await pg.waitForTimeout(900);
    for (const s of steps) await click(pg, s);
    await pg.waitForTimeout(300);
    await shot(pg, `${theme}-${name}`);
    await pg.context().close();
  }
}
await browser.close(); server.close();
console.log('design baselines written to', OUT);
