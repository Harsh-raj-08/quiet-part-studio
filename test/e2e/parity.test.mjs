// Pixel parity against the design's rendered baselines at 1440x1000.
// Writes [design | app | diff] sheets to test/output/parity-*.png and prints the percentages.
// Fails above THRESHOLD unless PARITY_ASSERT=0 (CI sets 0: its fonts differ from the local baselines).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium, startServer, OUT } from '../helpers.mjs';
import { captureApp, compare, readDesign, saveSheet } from '../parity-lib.mjs';

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
