// Shared helpers for the browser tests: static server for the mock-mode bundle, browser launch, page factory.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
export const { chromium } = require('playwright');
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DIST = path.join(root, 'test/dist');
export const OUT = path.join(root, 'test/output');
fs.mkdirSync(OUT, { recursive: true });

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

/** Tiny static server with SPA fallback. Port 0, so parallel test files never collide. */
export async function startServer(dir = DIST) {
  const server = http.createServer((req, res) => {
    const p = decodeURIComponent((req.url || '/').split('?')[0]);
    let f = path.join(dir, p);
    if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dir, 'index.html');
    res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(fs.readFileSync(f));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}`;
  return { url, close: () => new Promise((r) => server.close(r)) };
}

export const FIXED_NOW = '2026-10-11T12:00:00Z'; // "Sunday 11 October", the design's date

/**
 * Open the app in a fresh context.
 * opts: theme ('night'|'paper'), width, height, hash, reducedMotion, sideHidden (remembered state), now, allowExternal
 */
export async function openApp(browser, base, opts = {}) {
  const ctx = await browser.newContext({
    viewport: { width: opts.width ?? 1440, height: opts.height ?? 1000 },
    reducedMotion: opts.reducedMotion ? 'reduce' : 'no-preference',
    timezoneId: 'UTC', locale: 'en-GB', acceptDownloads: true,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  // Offline like CI: fonts and anything else outside the local server is refused.
  await page.route('**/*', (r) => (r.request().url().startsWith(base) ? r.continue() : r.abort()));
  await page.clock.setFixedTime(new Date(opts.now ?? FIXED_NOW));
  const seed = {};
  if (opts.theme) seed['qps.theme'] = opts.theme;
  if (opts.sideHidden) seed['qps.sideHidden'] = '1';
  if (opts.view) seed['qps.ideasView'] = opts.view;
  await page.addInitScript((s) => { try { for (const k of Object.keys(s)) localStorage.setItem(k, s[k]); } catch {} }, seed);
  await page.goto(`${base}/${opts.hash ?? ''}`);
  if (opts.ready !== false) await page.waitForSelector(opts.readySelector ?? '[data-board], [data-list], [data-screen]');
  return { page, ctx, errors };
}

// Console noise that is the test environment's, not the app's (the sandbox blocks Google Fonts).
export const benign = (e) => /Failed to load resource|net::ERR_FAILED|fonts\.(googleapis|gstatic)/i.test(e);

export async function mock(page, fn, ...args) {
  return page.evaluate(([src, a]) => (new Function('m', 'args', `return (${src})(m, ...args)`))(window.__mock, a), [fn.toString(), args]);
}
