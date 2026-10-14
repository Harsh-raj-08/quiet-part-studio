// Pixel parity against the design's rendered baselines at 1440x1000.
// Writes [design | app | diff] sheets to test/output/parity-*.png and prints the percentages.
// Fails above THRESHOLD unless PARITY_ASSERT=0 (CI sets 0: its fonts differ from the local baselines).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium, startServer, OUT } from '../helpers.mjs';
import { captureApp, captureScreens, compare, compareAligned, readDesign, saveSheet } from '../parity-lib.mjs';

const THRESHOLD = 3; // percent of pixels, full frame
const THRESHOLD_MASKED = 2;
let srv, browser;
before(async () => { srv = await startServer(); browser = await chromium.launch(); });
after(async () => { await browser.close(); await srv.close(); });

const results = [];
for (const theme of ['night', 'paper']) {
  test(`parity ${theme}`, async () => {
    const { shots, masks, errors } = await captureApp(browser, srv.url, theme);
    for (const name of Object.keys(shots)) {
      const design = readDesign(name);
      fs.writeFileSync(path.join(OUT, `app-${name}.png`), shots[name]);
      const full = await compare(browser, design, shots[name]);
      const masked = await compare(browser, design, shots[name], masks[name]);
      saveSheet(name, full.sheet);
      results.push({ name, full: full.pct, masked: masked.pct });
      console.log(`parity ${name}: ${full.pct.toFixed(2)}% (${masked.pct.toFixed(2)}% with the headline masked)`);
      if (process.env.PARITY_ASSERT !== '0') {
        assert.ok(full.pct < THRESHOLD, `${name} differs by ${full.pct.toFixed(2)}%`);
        assert.ok(masked.pct < THRESHOLD_MASKED, `${name} (masked) differs by ${masked.pct.toFixed(2)}%`);
      }
    }
    assert.equal(errors.filter((e) => !/Failed to load resource|ERR_FAILED/.test(e)).length, 0);
  });
}

// Phase 3b: Studio (grid + the four pack sub-tabs) and Library (shelf, notes, bank). No mask: the extras
// the design doesn't show (hooks row, rating, lanes, file fold, filters) are counted in the figure.
const THRESHOLD_3B = 4;
for (const theme of ['night', 'paper']) {
  test(`parity screens (studio, library, discover, insights, system) ${theme}`, async () => {
    const { shots, errors } = await captureScreens(browser, srv.url, theme);
    for (const name of Object.keys(shots)) {
      const design = readDesign(name);
      fs.writeFileSync(path.join(OUT, `app-${name}.png`), shots[name]);
      const full = await compare(browser, design, shots[name]);
      saveSheet(name, full.sheet);
      // Discover's headline wraps to three lines with the demo counts (two in the design), shifting the page.
      const al = /discover/.test(name) ? await compareAligned(browser, design, shots[name]) : null;
      console.log(`parity ${name}: ${full.pct.toFixed(2)}%${al ? ` (${al.pct.toFixed(2)}% below the hero, aligned by ${al.dy}px)` : ''}`);
      if (process.env.PARITY_ASSERT !== '0') assert.ok((al ? al.pct : full.pct) < THRESHOLD_3B, `${name} differs by ${(al ? al.pct : full.pct).toFixed(2)}%`);
    }
    assert.equal(errors.filter((e) => !/Failed to load resource|ERR_FAILED/.test(e)).length, 0);
  });
}
